package service

import (
	"context"
	"fmt"
	"math/rand"
	"net"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle/lifecycletest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
)

// fakeGregorConn models the handler's connection: it can exist without being
// connected (stale), and connectNow does nothing while one exists.
type fakeGregorConn struct {
	sync.Mutex
	exists    bool
	up        bool
	uri       *rpc.FMPURI
	connects  int
	shutdowns int
	resets    int
}

func (f *fakeGregorConn) connectNow(uri *rpc.FMPURI) error {
	f.Lock()
	defer f.Unlock()
	if !f.exists {
		f.exists, f.up = true, true
		f.uri = uri
		f.connects++
	}
	return nil
}

func (f *fakeGregorConn) Shutdown(context.Context) {
	f.Lock()
	defer f.Unlock()
	if f.exists {
		f.exists, f.up = false, false
		f.shutdowns++
	}
}

func (f *fakeGregorConn) Reset() error {
	f.Shutdown(context.Background())
	f.Lock()
	defer f.Unlock()
	f.resets++
	return nil
}

// goStale leaves the connection in place but not connected, as when its auth
// fails with an error the connection does not retry.
func (f *fakeGregorConn) goStale() {
	f.Lock()
	defer f.Unlock()
	f.up = false
}

func (f *fakeGregorConn) IsConnected() bool {
	f.Lock()
	defer f.Unlock()
	return f.up
}

type fakeGregorCounts struct {
	up                          bool
	connects, shutdowns, resets int
}

func (f *fakeGregorConn) counts() fakeGregorCounts {
	f.Lock()
	defer f.Unlock()
	return fakeGregorCounts{up: f.up, connects: f.connects, shutdowns: f.shutdowns, resets: f.resets}
}

func (f *fakeGregorConn) lastURI() *rpc.FMPURI {
	f.Lock()
	defer f.Unlock()
	return f.uri
}

type gregorConnTest struct {
	tc    libkb.TestContext
	gate  *gregorConnGate
	conn  *fakeGregorConn
	pings *atomic.Int64
}

func testGregorURI(t testing.TB, host string) *rpc.FMPURI {
	uri, err := rpc.ParseFMPURI(fmt.Sprintf("fmprpc+tls://%s:443", host))
	require.NoError(t, err)
	return uri
}

// setupGregorConn builds a gate in state and starts it, as Init does before
// the service's first connect.
func setupGregorConn(t *testing.T, state keybase1.MobileAppState) *gregorConnTest {
	tc := libkb.SetupTest(t, "gregorconn", 2)
	t.Cleanup(tc.Cleanup)
	tc.G.MobileAppState.Update(state)
	conn := &fakeGregorConn{}
	pings := &atomic.Int64{}
	gate := newGregorConnGate(tc.G, conn,
		func(ctx context.Context, format string, args ...any) { t.Logf(format, args...) },
		func(context.Context) { pings.Add(1) })
	gate.start()
	t.Cleanup(func() {
		gate.stop()
		select {
		case <-gate.monitorDone:
		case <-time.After(10 * time.Second):
			t.Error("monitor did not exit on stop")
		}
	})
	return &gregorConnTest{tc: tc, gate: gate, conn: conn, pings: pings}
}

// waitMonitor waits until the monitor has acted on the current states and is
// waiting for the next change.
func (c *gregorConnTest) waitMonitor(t *testing.T) {
	t.Helper()
	g := c.tc.G
	require.Eventually(t, func() bool {
		c.gate.mu.Lock()
		state, suspended := c.gate.monitorState, c.gate.monitorSuspended
		wait, suspendWait := c.gate.monitorWait, c.gate.monitorSuspendWait
		c.gate.mu.Unlock()
		if wait == nil || wait != g.MobileAppState.NextUpdate(state) ||
			suspendWait != g.DesktopAppState.NextSuspendUpdate(suspended) {
			return false
		}
		select {
		case <-wait:
			return false
		case <-suspendWait:
			return false
		default:
			return true
		}
	}, 10*time.Second, time.Millisecond, "monitor did not catch up")
}

func (c *gregorConnTest) update(t *testing.T, state keybase1.MobileAppState) {
	t.Helper()
	c.tc.G.MobileAppState.Update(state)
	c.waitMonitor(t)
}

func (c *gregorConnTest) requireUp(t *testing.T, up bool, msg string) {
	t.Helper()
	require.Equal(t, up, c.conn.IsConnected(), msg)
}

func TestGregorConnStartupInBackground(t *testing.T) {
	c := setupGregorConn(t, keybase1.MobileAppState_BACKGROUND)
	c.waitMonitor(t)
	uri := testGregorURI(t, "gregord.test")
	require.NoError(t, c.gate.connect(context.Background(), uri, false))
	c.requireUp(t, false, "connected during a background launch")
	require.Equal(t, 0, c.conn.counts().connects)

	c.update(t, keybase1.MobileAppState_BACKGROUNDACTIVE)
	c.requireUp(t, true, "did not connect on leaving BACKGROUND")
	require.Equal(t, uri, c.conn.lastURI())
	require.Equal(t, fakeGregorCounts{up: true, connects: 1}, c.conn.counts())
}

func TestGregorConnLoginInBackground(t *testing.T) {
	c := setupGregorConn(t, keybase1.MobileAppState_FOREGROUND)
	c.waitMonitor(t)
	first := testGregorURI(t, "first.test")
	require.NoError(t, c.gate.connect(context.Background(), first, true))
	require.Equal(t, fakeGregorCounts{up: true, connects: 1, resets: 1}, c.conn.counts())

	c.update(t, keybase1.MobileAppState_BACKGROUND)
	c.requireUp(t, false, "still connected in BACKGROUND")

	second := testGregorURI(t, "second.test")
	require.NoError(t, c.gate.connect(context.Background(), second, true))
	c.requireUp(t, false, "login connected in BACKGROUND")
	require.Equal(t, fakeGregorCounts{connects: 1, shutdowns: 1, resets: 2}, c.conn.counts())

	c.update(t, keybase1.MobileAppState_FOREGROUND)
	c.requireUp(t, true, "did not connect on foreground after a background login")
	require.Equal(t, second, c.conn.lastURI())

	// A login while connected resets the connection before connecting.
	require.NoError(t, c.gate.connect(context.Background(), first, true))
	require.Equal(t, fakeGregorCounts{up: true, connects: 3, shutdowns: 2, resets: 3}, c.conn.counts())
	require.Equal(t, first, c.conn.lastURI())
}

func TestGregorConnInactiveStaysConnected(t *testing.T) {
	c := setupGregorConn(t, keybase1.MobileAppState_FOREGROUND)
	c.waitMonitor(t)
	require.NoError(t, c.gate.connect(context.Background(), testGregorURI(t, "gregord.test"), false))
	for range 3 {
		c.update(t, keybase1.MobileAppState_INACTIVE)
		c.requireUp(t, true, "INACTIVE disconnected")
		c.update(t, keybase1.MobileAppState_FOREGROUND)
		c.requireUp(t, true, "FOREGROUND disconnected")
	}
	require.Equal(t, fakeGregorCounts{up: true, connects: 1}, c.conn.counts())
	require.EqualValues(t, 3, c.pings.Load())
}

func TestGregorConnDuplicateEvents(t *testing.T) {
	c := setupGregorConn(t, keybase1.MobileAppState_BACKGROUND)
	c.waitMonitor(t)
	uri := testGregorURI(t, "gregord.test")
	for range 3 {
		require.NoError(t, c.gate.connect(context.Background(), uri, false))
	}
	for range 3 {
		c.update(t, keybase1.MobileAppState_BACKGROUND)
	}
	require.Equal(t, fakeGregorCounts{}, c.conn.counts())

	for round := 1; round <= 3; round++ {
		for range 3 {
			c.update(t, keybase1.MobileAppState_BACKGROUNDACTIVE)
			c.requireUp(t, true, "down in BACKGROUNDACTIVE")
		}
		for range 3 {
			c.update(t, keybase1.MobileAppState_FOREGROUND)
			require.NoError(t, c.gate.connect(context.Background(), uri, false))
			c.requireUp(t, true, "down in FOREGROUND")
		}
		for range 3 {
			c.update(t, keybase1.MobileAppState_BACKGROUND)
			require.NoError(t, c.gate.connect(context.Background(), uri, false))
			c.requireUp(t, false, "up in BACKGROUND")
		}
		require.Equal(t, fakeGregorCounts{connects: round, shutdowns: round}, c.conn.counts())
	}
	require.EqualValues(t, 3, c.pings.Load())
}

var allAppStates = []keybase1.MobileAppState{
	keybase1.MobileAppState_INACTIVE,
	keybase1.MobileAppState_FOREGROUND,
	keybase1.MobileAppState_BACKGROUND,
	keybase1.MobileAppState_BACKGROUNDACTIVE,
	keybase1.MobileAppState_FOREGROUND,
	keybase1.MobileAppState_BACKGROUND,
	keybase1.MobileAppState_INACTIVE,
}

// requireStaysDown drives every transition and checks that nothing connects.
func (c *gregorConnTest) requireStaysDown(t *testing.T, why string) {
	t.Helper()
	connects := c.conn.counts().connects
	for _, state := range allAppStates {
		c.update(t, state)
		_, err := c.gate.reconnect(context.Background())
		require.NoError(t, err)
		c.requireUp(t, false, fmt.Sprintf("connected in %v %s", state, why))
	}
	require.Equal(t, connects, c.conn.counts().connects, "connect attempted "+why)
}

func TestGregorConnLogoutStaysDown(t *testing.T) {
	c := setupGregorConn(t, keybase1.MobileAppState_FOREGROUND)
	c.waitMonitor(t)
	uri := testGregorURI(t, "gregord.test")
	require.NoError(t, c.gate.connect(context.Background(), uri, true))
	c.requireUp(t, true, "login did not connect")

	require.NoError(t, c.gate.forget(context.Background()))
	c.requireUp(t, false, "logout left gregor connected")
	c.requireStaysDown(t, "after logout")

	c.update(t, keybase1.MobileAppState_FOREGROUND)
	require.NoError(t, c.gate.connect(context.Background(), uri, true))
	c.requireUp(t, true, "login after logout did not connect")
}

func TestGregorConnLogoutInBackground(t *testing.T) {
	c := setupGregorConn(t, keybase1.MobileAppState_FOREGROUND)
	c.waitMonitor(t)
	require.NoError(t, c.gate.connect(context.Background(), testGregorURI(t, "gregord.test"), true))
	c.update(t, keybase1.MobileAppState_BACKGROUND)
	require.NoError(t, c.gate.forget(context.Background()))
	c.update(t, keybase1.MobileAppState_BACKGROUNDACTIVE)
	c.update(t, keybase1.MobileAppState_FOREGROUND)
	c.requireUp(t, false, "foreground after a background logout connected")
	require.Equal(t, 1, c.conn.counts().connects)
}

// A connection whose auth failed while logged out stays in place without
// being connected; the next login must still connect.
func TestGregorConnLoginReplacesStaleConn(t *testing.T) {
	c := setupGregorConn(t, keybase1.MobileAppState_FOREGROUND)
	c.waitMonitor(t)
	uri := testGregorURI(t, "gregord.test")
	require.NoError(t, c.gate.connect(context.Background(), uri, false))
	c.conn.goStale()
	c.update(t, keybase1.MobileAppState_INACTIVE)
	c.update(t, keybase1.MobileAppState_FOREGROUND)
	require.NoError(t, c.gate.connect(context.Background(), uri, true))
	c.requireUp(t, true, "login left a stale connection in place")
	require.Equal(t, fakeGregorCounts{up: true, connects: 2, shutdowns: 1, resets: 1}, c.conn.counts())
}

// A BACKGROUND applied while a connect is deciding must not leave gregor
// connected.
func TestGregorConnBackgroundRacingConnect(t *testing.T) {
	c := setupGregorConn(t, keybase1.MobileAppState_FOREGROUND)
	c.waitMonitor(t)
	c.gate.beforeConnect = func() {
		// connect has read FOREGROUND. The monitor is idle, so mu is held
		// here only if connect holds it; otherwise let the monitor fully
		// apply BACKGROUND before connect acts on its stale read.
		holdsMu := !c.gate.mu.TryLock()
		if !holdsMu {
			c.gate.mu.Unlock()
		}
		c.tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
		if !holdsMu {
			c.waitMonitor(t)
		}
	}
	require.NoError(t, c.gate.connect(context.Background(), testGregorURI(t, "gregord.test"), false))
	c.waitMonitor(t)
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, c.tc.G.MobileAppState.State())
	c.requireUp(t, false, "connected in BACKGROUND after racing a connect")
}

func TestGregorConnReconnectInBackground(t *testing.T) {
	c := setupGregorConn(t, keybase1.MobileAppState_FOREGROUND)
	c.waitMonitor(t)
	uri := testGregorURI(t, "gregord.test")
	require.NoError(t, c.gate.connect(context.Background(), uri, false))

	didShutdown, err := c.gate.reconnect(context.Background())
	require.NoError(t, err)
	require.True(t, didShutdown)
	require.Equal(t, fakeGregorCounts{up: true, connects: 2, shutdowns: 1}, c.conn.counts())

	// A connection left up while BACKGROUND lands, as when a ping times out
	// before the monitor has acted.
	c.gate.mu.Lock()
	c.tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	c.gate.mu.Unlock()
	c.waitMonitor(t)
	require.NoError(t, c.conn.connectNow(uri))
	didShutdown, err = c.gate.reconnect(context.Background())
	require.NoError(t, err)
	require.True(t, didShutdown)
	c.requireUp(t, false, "reconnect connected in BACKGROUND")

	didShutdown, err = c.gate.reconnect(context.Background())
	require.NoError(t, err)
	require.False(t, didShutdown)
	c.requireUp(t, false, "reconnect connected while disconnected")
}

func TestGregorConnDesktopSuspend(t *testing.T) {
	c := setupGregorConn(t, keybase1.MobileAppState_FOREGROUND)
	c.waitMonitor(t)
	require.NoError(t, c.gate.connect(context.Background(), testGregorURI(t, "gregord.test"), false))
	mctx := libkb.NewMetaContextForTest(c.tc)
	c.tc.G.DesktopAppState.Update(mctx, "suspend", nil)
	c.waitMonitor(t)
	c.requireUp(t, false, "connected while suspended")
	c.tc.G.DesktopAppState.Update(mctx, "resume", nil)
	c.waitMonitor(t)
	c.requireUp(t, true, "did not connect on resume")
	require.Equal(t, fakeGregorCounts{up: true, connects: 2, shutdowns: 1}, c.conn.counts())
}

// TestGregorConnScenarioReplay replays every lifecycle scenario from the
// service's startup connect: gregor is connected after each step exactly
// when the app is not in BACKGROUND, and a login at that point doesn't
// change that.
func TestGregorConnScenarioReplay(t *testing.T) {
	for _, sc := range lifecycletest.Scenarios {
		t.Run(sc.Name, func(t *testing.T) {
			c := setupGregorConn(t, sc.Platform.InitialState())
			uri := testGregorURI(t, "gregord.test")
			require.NoError(t, c.gate.connect(context.Background(), uri, false))
			lifecycletest.Play(t, c.tc.G.MobileAppState, sc, func(h *lifecycletest.Harness, i int, step lifecycletest.Step) {
				want := step.Want != keybase1.MobileAppState_BACKGROUND
				c.waitMonitor(t)
				if got := c.conn.IsConnected(); got != want {
					t.Fatalf("step %d %v: connected %v in %v", i, step.Do, got, step.Want)
				}
				require.NoError(t, c.gate.connect(context.Background(), uri, true))
				c.waitMonitor(t)
				if got := c.conn.IsConnected(); got != want {
					t.Fatalf("step %d %v: connected %v in %v after a login", i, step.Do, got, step.Want)
				}
				require.NoError(t, c.gate.forget(context.Background()))
				c.waitMonitor(t)
				if c.conn.IsConnected() {
					t.Fatalf("step %d %v: connected in %v after a logout", i, step.Do, step.Want)
				}
				require.NoError(t, c.gate.connect(context.Background(), uri, true))
				c.waitMonitor(t)
				if got := c.conn.IsConnected(); got != want {
					t.Fatalf("step %d %v: connected %v in %v after a logout and login", i, step.Do, got, step.Want)
				}
			})
		})
		t.Run(sc.Name+"/logged out", func(t *testing.T) {
			c := setupGregorConn(t, keybase1.MobileAppState_FOREGROUND)
			require.NoError(t, c.gate.connect(context.Background(), testGregorURI(t, "gregord.test"), true))
			require.NoError(t, c.gate.forget(context.Background()))
			lifecycletest.Play(t, c.tc.G.MobileAppState, sc, func(h *lifecycletest.Harness, i int, step lifecycletest.Step) {
				c.waitMonitor(t)
				if c.conn.IsConnected() || c.conn.counts().connects != 1 {
					t.Fatalf("step %d %v: connect attempted in %v while logged out", i, step.Do, step.Want)
				}
			})
		})
	}
}

func TestGregorConnStress(t *testing.T) {
	tc := libkb.SetupTest(t, "gregorconn", 1)
	defer tc.Cleanup()
	baseline := runtime.NumGoroutine()

	conn := &fakeGregorConn{}
	gate := newGregorConnGate(tc.G, conn, func(context.Context, string, ...any) {}, func(context.Context) {})
	gate.start()
	c := &gregorConnTest{tc: tc, gate: gate, conn: conn}
	uri := testGregorURI(t, "gregord.test")
	states := []keybase1.MobileAppState{
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_BACKGROUND,
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_BACKGROUNDACTIVE,
	}

	stop := make(chan struct{})
	var workers, writers sync.WaitGroup
	for w := range 4 {
		workers.Add(1)
		go func() {
			defer workers.Done()
			ctx := context.Background()
			for i := 0; ; i++ {
				select {
				case <-stop:
					return
				default:
				}
				switch (i + w) % 4 {
				case 0:
					_ = gate.connect(ctx, uri, false)
				case 1:
					_ = gate.connect(ctx, uri, true)
				case 2:
					_ = gate.forget(ctx)
				default:
					_, _ = gate.reconnect(ctx)
				}
				runtime.Gosched()
			}
		}()
	}
	for w := range 4 {
		writers.Add(1)
		go func() {
			defer writers.Done()
			rng := rand.New(rand.NewSource(int64(w)))
			for range 500 {
				tc.G.MobileAppState.Update(states[rng.Intn(len(states))])
				if rng.Intn(4) == 0 {
					time.Sleep(time.Duration(rng.Intn(200)) * time.Microsecond)
				}
			}
		}()
	}

	done := make(chan struct{})
	go func() {
		writers.Wait()
		close(stop)
		workers.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(60 * time.Second):
		t.Fatal("deadlock: transitions and connects did not finish")
	}

	require.NoError(t, gate.forget(context.Background()))
	c.requireStaysDown(t, "after settling logged out")
	require.NoError(t, gate.connect(context.Background(), uri, true))
	c.requireUp(t, true, "login did not connect after settling")
	c.update(t, keybase1.MobileAppState_BACKGROUND)
	c.requireUp(t, false, "up after settling in BACKGROUND")
	c.update(t, keybase1.MobileAppState_BACKGROUNDACTIVE)
	c.requireUp(t, true, "down after settling in BACKGROUNDACTIVE")
	counts := conn.counts()
	t.Logf("%d connects, %d shutdowns, %d resets", counts.connects, counts.shutdowns, counts.resets)

	gate.stop()
	select {
	case <-gate.monitorDone:
	case <-time.After(10 * time.Second):
		t.Fatal("monitor did not exit on stop")
	}
	deadline := time.Now().Add(10 * time.Second)
	for runtime.NumGoroutine() > baseline && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	require.LessOrEqual(t, runtime.NumGoroutine(), baseline, "leaked goroutines")
}

// Connects and shutdowns race the connection's own goroutines: OnConnect
// reads the URI, the ping loop watches its shutdown channel, and the
// transport dials.
func TestGregorHandlerConnectRaces(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	g.Syncer = chat.NewSyncer(g)

	uri := closedPortURI(t)
	h := newGregorHandler(g)
	stop := make(chan struct{})
	readerDone := make(chan struct{})
	go func() {
		defer close(readerDone)
		for {
			select {
			case <-stop:
				return
			default:
			}
			_ = h.GetURI()
			runtime.Gosched()
		}
	}()
	for i := range 20 {
		require.NoError(t, h.Connect(uri))
		// Vary how far the dial gets before the shutdown.
		time.Sleep(time.Duration(i%4) * time.Millisecond)
		h.Shutdown(context.Background())
	}
	close(stop)
	<-readerDone
	require.Equal(t, uri, h.GetURI())
}

// closedPortURI points at a closed port, so a connection only retries until
// shut down.
func closedPortURI(t *testing.T) *rpc.FMPURI {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	addr := l.Addr().String()
	require.NoError(t, l.Close())
	uri, err := rpc.ParseFMPURI("fmprpc://" + addr)
	require.NoError(t, err)
	return uri
}

func hasConn(h *gregorHandler) bool {
	h.connMutex.Lock()
	defer h.connMutex.Unlock()
	return h.conn != nil
}

// The service's startup and login connects go through the handler's gate.
// Logout goes through the handler's gate, so no transition reconnects.
func TestGregorHandlerDisconnectStaysDown(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	g.Syncer = chat.NewSyncer(g)

	h := newGregorHandler(g)
	require.NoError(t, h.ConnectFresh(closedPortURI(t)))
	require.True(t, hasConn(h), "did not connect")
	require.NoError(t, h.Disconnect())
	require.False(t, hasConn(h), "Disconnect left a connection")
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	h.connGate.reconcile(context.Background())
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	h.connGate.reconcile(context.Background())
	require.False(t, hasConn(h), "reconnected after Disconnect")
}

func TestGregorHandlerConnectInBackground(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	g.Syncer = chat.NewSyncer(g)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)

	h := newGregorHandler(g)
	uri := closedPortURI(t)
	require.NoError(t, h.Connect(uri))
	require.False(t, hasConn(h), "Connect connected in BACKGROUND")
	require.NoError(t, h.ConnectFresh(uri))
	require.False(t, hasConn(h), "ConnectFresh connected in BACKGROUND")

	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	h.connGate.reconcile(context.Background())
	require.True(t, hasConn(h), "did not connect on leaving BACKGROUND")
	h.Shutdown(context.Background())
}
