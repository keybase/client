package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/gregor"
	grclient "github.com/keybase/client/go/gregor/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle/lifecycletest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
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

// acceptingListener accepts and holds connections, counting them, so a
// connection dials successfully and then fails in OnConnect.
type acceptingListener struct {
	net.Listener
	accepts atomic.Int64
	mu      sync.Mutex
	conns   []net.Conn
}

func newAcceptingListener(t *testing.T) *acceptingListener {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	a := &acceptingListener{Listener: l}
	go func() {
		for {
			c, err := l.Accept()
			if err != nil {
				return
			}
			a.mu.Lock()
			a.conns = append(a.conns, c)
			a.mu.Unlock()
			a.accepts.Add(1)
		}
	}()
	t.Cleanup(func() {
		_ = l.Close()
		a.mu.Lock()
		defer a.mu.Unlock()
		for _, c := range a.conns {
			_ = c.Close()
		}
	})
	return a
}

func (a *acceptingListener) uri(t *testing.T) *rpc.FMPURI {
	uri, err := rpc.ParseFMPURI("fmprpc://" + a.Addr().String())
	require.NoError(t, err)
	return uri
}

// requireStale waits until the handler holds a connection that is not
// connected: with nobody logged in, OnConnect fails with an auth error the
// connection does not retry on its own.
func requireStale(t *testing.T, h *gregorHandler, a *acceptingListener, accepts int64) {
	t.Helper()
	require.Eventually(t, func() bool {
		return a.accepts.Load() >= accepts && hasConn(h) && !h.IsConnected()
	}, 10*time.Second, time.Millisecond, "connection did not fail")
}

// After a terminal connect failure, the ping loop's pings redial at the ping
// interval, without tearing the connection down and without spinning.
func TestGregorHandlerTerminalFailureRedialsOnPing(t *testing.T) {
	t.Setenv("KEYBASE_PUSH_PING_INTERVAL", "100ms")
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	g.Syncer = chat.NewSyncer(g)
	a := newAcceptingListener(t)

	h := newGregorHandler(g)
	defer h.Shutdown(context.Background())
	require.NoError(t, h.Connect(a.uri(t)))
	requireStale(t, h, a, 1)
	start := a.accepts.Load()
	time.Sleep(time.Second)
	redials := a.accepts.Load() - start
	t.Logf("%d redials in 1s", redials)
	require.GreaterOrEqual(t, redials, int64(3), "ping loop did not redial a failed connection")
	require.LessOrEqual(t, redials, int64(13), "redialing faster than the ping interval")
	require.True(t, hasConn(h), "failed connection was torn down")
}

// A transition to FOREGROUND redials a failed connection right away instead
// of waiting for the next ping.
func TestGregorHandlerTerminalFailureRedialsOnForeground(t *testing.T) {
	t.Setenv("KEYBASE_PUSH_PING_INTERVAL", "1h")
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	g.Syncer = chat.NewSyncer(g)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_INACTIVE)
	a := newAcceptingListener(t)

	h := newGregorHandler(g)
	h.Init()
	defer h.Shutdown(context.Background())
	require.NoError(t, h.Connect(a.uri(t)))
	requireStale(t, h, a, 1)
	time.Sleep(200 * time.Millisecond)
	require.EqualValues(t, 1, a.accepts.Load())

	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	require.Eventually(t, func() bool { return a.accepts.Load() >= 2 }, 10*time.Second, time.Millisecond,
		"FOREGROUND did not redial a failed connection")
	require.True(t, hasConn(h), "failed connection was torn down")
}

// An OnConnect that passed its connection check before a logout must not
// install a gregor client for the dropped connection.
func TestGregorClientInstallRacingLogout(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	g.Syncer = chat.NewSyncer(g)
	ctx := context.Background()

	h := newGregorHandler(g)
	require.NoError(t, h.Connect(closedPortURI(t)))
	h.connMutex.Lock()
	conn := h.conn
	h.connMutex.Unlock()
	uid := gregor1.UID(make([]byte, 16))
	deviceID := gregor1.DeviceID(make([]byte, 16))

	gcli, err := h.resetGregorClientFor(ctx, conn, uid, deviceID)
	require.NoError(t, err)
	require.NotNil(t, gcli)
	_, err = h.getGregorCli()
	require.NoError(t, err, "current connection did not install its client")

	h.beforeGregorClientInstall = func() { require.NoError(t, h.Disconnect()) }
	_, err = h.resetGregorClientFor(ctx, conn, uid, deviceID)
	require.ErrorIs(t, err, chat.ErrDuplicateConnection)
	_, err = h.getGregorCli()
	require.Error(t, err, "installed a client for a connection logout dropped")
}

type fakeSyncer struct {
	types.Syncer
	mu        sync.Mutex
	connected bool
	connects  int
	// beforeMark, if set, runs once inside Connected before the syncer is
	// marked connected, as a logout landing just before the mark would.
	beforeMark func()
	// onConnected, if set, runs once inside Connected, after the syncer is
	// marked connected, as a logout landing during the sync would.
	onConnected func()
}

func (s *fakeSyncer) IsConnected(context.Context) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.connected
}

func (s *fakeSyncer) Connected(context.Context, chat1.RemoteInterface, gregor1.UID, *chat1.SyncChatRes) error {
	s.mu.Lock()
	before := s.beforeMark
	s.beforeMark = nil
	s.mu.Unlock()
	if before != nil {
		before()
	}
	s.mu.Lock()
	s.connected = true
	s.connects++
	f := s.onConnected
	s.onConnected = nil
	s.mu.Unlock()
	if f != nil {
		f()
	}
	return nil
}

func (s *fakeSyncer) Disconnected(context.Context) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.connected = false
}

func (s *fakeSyncer) connectCalls() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.connects
}

type fakeBadger struct {
	mu                sync.Mutex
	loggedOut         bool
	pushes            int
	pushesAfterLogout int
	// onPush, if set, runs once inside a push.
	onPush func()
}

func (b *fakeBadger) push() {
	b.mu.Lock()
	b.pushes++
	if b.loggedOut {
		b.pushesAfterLogout++
	}
	f := b.onPush
	b.onPush = nil
	b.mu.Unlock()
	if f != nil {
		f()
	}
}

func (b *fakeBadger) PushState(context.Context, gregor.State)                    { b.push() }
func (b *fakeBadger) PushChatFullUpdate(context.Context, chat1.UnreadUpdateFull) { b.push() }

func (b *fakeBadger) logout() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.loggedOut = true
}

func (b *fakeBadger) counts() (pushes, afterLogout int) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.pushes, b.pushesAfterLogout
}

func currentConn(h *gregorHandler) *rpc.Connection {
	h.connMutex.Lock()
	defer h.connMutex.Unlock()
	return h.conn
}

type onConnectTailTest struct {
	h       *gregorHandler
	conn    *rpc.Connection
	gcli    *grclient.Client
	syncer  *fakeSyncer
	badger  *fakeBadger
	uid     gregor1.UID
	syncRes chat1.SyncAllResult
}

// setupOnConnectTail builds a handler with a current connection and a
// gregor client, as OnConnect has them once SyncAll has returned.
func setupOnConnectTail(t *testing.T) *onConnectTailTest {
	tc, g := setupGregorTest(t)
	t.Cleanup(tc.Cleanup)
	syncer := &fakeSyncer{}
	g.Syncer = syncer
	h := newGregorHandler(g)
	badger := &fakeBadger{}
	h.badger = badger
	require.NoError(t, h.Connect(closedPortURI(t)))
	t.Cleanup(func() { h.Shutdown(context.Background()) })
	conn := currentConn(h)
	uid := gregor1.UID(make([]byte, 16))
	gcli, err := h.resetGregorClientFor(context.Background(), conn, uid, gregor1.DeviceID(make([]byte, 16)))
	require.NoError(t, err)
	return &onConnectTailTest{
		h: h, conn: conn, gcli: gcli, syncer: syncer, badger: badger, uid: uid,
		syncRes: chat1.SyncAllResult{Notification: chat1.NewSyncAllNotificationResWithState(gregor1.State{})},
	}
}

func (c *onConnectTailTest) run() error {
	return c.h.onConnectSynced(context.Background(), c.conn, chat1.RemoteClient{}, nil, c.uid, c.gcli, c.syncRes)
}

// logout does what Service.OnLogout does to gregor, and marks every badge
// push from then on as leaked.
func (c *onConnectTailTest) logout(t *testing.T) {
	require.NoError(t, c.h.Disconnect())
	c.badger.logout()
}

func TestGregorOnConnectTailApplies(t *testing.T) {
	c := setupOnConnectTail(t)
	require.NoError(t, c.run())
	pushes, _ := c.badger.counts()
	require.Equal(t, 2, pushes)
	require.Len(t, c.h.replayCh, 1)
	require.True(t, c.syncer.IsConnected(context.Background()))
	require.False(t, c.h.isFirstConnect())
	require.False(t, c.h.connectedSince().IsZero())
}

// A logout landing before any step of OnConnect's tail leaves no trace of
// the old connection.
func TestGregorOnConnectTailRacingLogout(t *testing.T) {
	for _, tt := range []struct {
		name          string
		step          onConnectStep
		syncerConnect int
		stateSyncs    int
	}{
		{"chat badges", onConnectStepChatBadges, 0, 0},
		{"syncer", onConnectStepSyncer, 0, 0},
		{"server sync", onConnectStepServerSync, 1, 0},
		{"gregor badges", onConnectStepGregorBadges, 1, 1},
		{"connected", onConnectStepConnected, 1, 1},
	} {
		t.Run(tt.name, func(t *testing.T) {
			c := setupOnConnectTail(t)
			c.h.onConnectStep = func(step onConnectStep) {
				if step == tt.step {
					c.logout(t)
				}
			}
			require.ErrorIs(t, c.run(), chat.ErrDuplicateConnection)
			_, afterLogout := c.badger.counts()
			require.Zero(t, afterLogout, "badges pushed after logout")
			require.False(t, c.syncer.IsConnected(context.Background()), "syncer left connected after logout")
			require.Equal(t, tt.syncerConnect, c.syncer.connectCalls(), "chat sync ran after logout")
			require.Len(t, c.h.replayCh, tt.stateSyncs, "gregor state sync ran after logout")
			require.True(t, c.h.isFirstConnect(), "first connect cleared after logout")
			require.True(t, c.h.connectedSince().IsZero(), "connected time set after logout")
		})
	}
}

// A logout during the chat sync, before or after the syncer marks itself
// connected, leaves the syncer disconnected.
func TestGregorOnConnectLogoutDuringChatSync(t *testing.T) {
	for _, beforeMark := range []bool{true, false} {
		t.Run(fmt.Sprintf("before mark %v", beforeMark), func(t *testing.T) {
			c := setupOnConnectTail(t)
			if beforeMark {
				c.syncer.beforeMark = func() { c.logout(t) }
			} else {
				c.syncer.onConnected = func() { c.logout(t) }
			}
			require.ErrorIs(t, c.run(), chat.ErrDuplicateConnection)
			require.False(t, c.syncer.IsConnected(context.Background()), "syncer left connected after logout")
			require.True(t, c.h.isFirstConnect())
		})
	}
}

// The undo leaves alone a syncer that a newer connection has marked since.
func TestGregorOnConnectLogoutDuringChatSyncKeepsNewerConn(t *testing.T) {
	c := setupOnConnectTail(t)
	c.syncer.onConnected = func() {
		c.logout(t)
		// A newer connection, installed by hand so no dial's callbacks
		// touch the syncer.
		newer := &rpc.Connection{}
		c.h.connMutex.Lock()
		c.h.conn = newer
		c.h.shutdownCh = make(chan struct{})
		c.h.connMutex.Unlock()
		require.NoError(t, c.h.connectSyncer(context.Background(), newer, chat1.RemoteClient{}, c.uid, &chat1.SyncChatRes{}))
	}
	require.ErrorIs(t, c.run(), chat.ErrDuplicateConnection)
	require.True(t, c.syncer.IsConnected(context.Background()), "undo disconnected the newer connection's syncer")
}

// A logout can't finish while a badge push for the old connection is in
// progress, so the push can't land after the logout.
func TestGregorOnConnectBadgePushHoldsOffLogout(t *testing.T) {
	c := setupOnConnectTail(t)
	logoutDone := make(chan struct{})
	c.badger.onPush = func() {
		go func() {
			defer close(logoutDone)
			_ = c.h.Disconnect()
		}()
		select {
		case <-logoutDone:
			t.Error("logout finished during a badge push")
		case <-time.After(100 * time.Millisecond):
		}
	}
	require.ErrorIs(t, c.run(), chat.ErrDuplicateConnection)
	<-logoutDone
	pushes, _ := c.badger.counts()
	require.Equal(t, 1, pushes)
}

type failingRPCClient struct{}

func (failingRPCClient) Call(context.Context, string, any, any, time.Duration) error {
	return errors.New("no server")
}

func (failingRPCClient) CallCompressed(context.Context, string, any, any, rpc.CompressionType, time.Duration) error {
	return errors.New("no server")
}

func (failingRPCClient) Notify(context.Context, string, any, time.Duration) error {
	return errors.New("no server")
}

// An OnConnect that loses the client install to a logout fails with an error
// the connection does not retry.
func TestGregorOnConnectRacingLogoutIsNotRetried(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	g.Syncer = chat.NewSyncer(g)
	h := newGregorHandler(g)
	require.NoError(t, h.Connect(closedPortURI(t)))
	defer h.Shutdown(context.Background())
	conn := currentConn(h)

	h.authParamsForTest = func(context.Context) (gregor1.UID, gregor1.DeviceID, gregor1.SessionToken, *libkb.NIST, error) {
		return gregor1.UID(make([]byte, 16)), gregor1.DeviceID(make([]byte, 16)), "", nil, nil
	}
	h.beforeGregorClientInstall = func() { require.NoError(t, h.Disconnect()) }

	local, remote := net.Pipe()
	defer remote.Close()
	xp := rpc.NewTransport(local, libkb.NewRPCLogFactory(tc.G), tc.G.RemoteNetworkInstrumenterStorage,
		libkb.MakeWrapError(tc.G), rpc.DefaultMaxFrameLength)
	defer xp.Close()
	srv := rpc.NewServer(xp, libkb.MakeWrapError(tc.G))

	err := h.OnConnect(context.Background(), conn, failingRPCClient{}, srv)
	require.ErrorIs(t, err, chat.ErrDuplicateConnection)
	require.False(t, h.ShouldRetryOnConnect(err), "retrying a connection logout dropped")
	_, err = h.getGregorCli()
	require.Error(t, err, "installed a client for a connection logout dropped")
}
