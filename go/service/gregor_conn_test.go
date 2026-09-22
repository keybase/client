package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net"
	"os"
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

// gregorTestAppState wraps the real app state so a test can act between a
// connect's state read and what the connect does with that read.
type gregorTestAppState struct {
	*libkb.MobileAppState
	mu sync.Mutex
	// afterRead, if set, runs once after a State read, before the reader acts.
	afterRead func()
}

func (a *gregorTestAppState) State() keybase1.MobileAppState {
	state := a.MobileAppState.State()
	a.mu.Lock()
	f := a.afterRead
	a.afterRead = nil
	a.mu.Unlock()
	if f != nil {
		f()
	}
	return state
}

func (a *gregorTestAppState) setAfterRead(f func()) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.afterRead = f
}

type gregorConnTest struct {
	tc     libkb.TestContext
	gate   *gregorConnGate
	mobile *gregorTestAppState
	conn   *fakeGregorConn
	pings  *atomic.Int64
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
	mobile := &gregorTestAppState{MobileAppState: tc.G.MobileAppState}
	gate := newGregorConnGate(mobile, tc.G.DesktopAppState, conn,
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
	return &gregorConnTest{tc: tc, gate: gate, mobile: mobile, conn: conn, pings: pings}
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
		c.gate.reconnect(context.Background(), context.Background())
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
	c.mobile.setAfterRead(func() {
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
	})
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

	c.gate.reconnect(context.Background(), context.Background())
	require.Equal(t, fakeGregorCounts{up: true, connects: 2, shutdowns: 1}, c.conn.counts())

	// A connection left up while BACKGROUND lands, as when a ping times out
	// before the monitor has acted.
	c.gate.mu.Lock()
	c.tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	c.gate.mu.Unlock()
	c.waitMonitor(t)
	require.NoError(t, c.conn.connectNow(uri))
	c.gate.reconnect(context.Background(), context.Background())
	c.requireUp(t, false, "reconnect connected in BACKGROUND")
	require.Equal(t, fakeGregorCounts{connects: 3, shutdowns: 3}, c.conn.counts())

	c.gate.reconnect(context.Background(), context.Background())
	c.requireUp(t, false, "reconnect connected while disconnected")
	require.Equal(t, fakeGregorCounts{connects: 3, shutdowns: 3}, c.conn.counts())
}

// A reconnect request returns without waiting, even while the gate is held,
// and a burst of requests made before the monitor runs is one reconnect.
func TestGregorConnReconnectRequestsCoalesce(t *testing.T) {
	tc := libkb.SetupTest(t, "gregorconn", 1)
	defer tc.Cleanup()
	conn := &fakeGregorConn{}
	mobile := &gregorTestAppState{MobileAppState: tc.G.MobileAppState}
	gate := newGregorConnGate(mobile, tc.G.DesktopAppState, conn,
		func(ctx context.Context, format string, args ...any) { t.Logf(format, args...) },
		func(context.Context) {})
	c := &gregorConnTest{tc: tc, gate: gate, mobile: mobile, conn: conn}
	require.NoError(t, gate.connect(context.Background(), testGregorURI(t, "gregord.test"), false))

	gate.mu.Lock()
	done := make(chan struct{})
	go func() {
		defer close(done)
		for range 10 {
			gate.requestReconnect(context.Background(), context.Background())
		}
	}()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("a reconnect request waited")
	}
	gate.mu.Unlock()
	require.Equal(t, fakeGregorCounts{up: true, connects: 1}, conn.counts(), "reconnected without the monitor")

	gate.start()
	defer func() {
		gate.stop()
		<-gate.monitorDone
	}()
	want := fakeGregorCounts{up: true, connects: 2, shutdowns: 1}
	require.Eventually(t, func() bool { return conn.counts() == want }, 10*time.Second, time.Millisecond,
		"did not reconnect exactly once")
	c.waitMonitor(t)
	require.Empty(t, gate.reconnectCh, "a request is still pending")
	require.Equal(t, want, conn.counts(), "reconnected more than once")
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

// A ping timeout that reconnects while the machine is suspended must not
// dial, and neither must a connect; resuming connects.
func TestGregorReconnectWhileSuspendedDoesNotConnect(t *testing.T) {
	c := setupGregorConn(t, keybase1.MobileAppState_FOREGROUND)
	c.waitMonitor(t)
	uri := testGregorURI(t, "gregord.test")
	require.NoError(t, c.gate.connect(context.Background(), uri, false))

	// A connection left up while the suspend lands, as when a ping times out
	// before the monitor has acted.
	mctx := libkb.NewMetaContextForTest(c.tc)
	c.gate.mu.Lock()
	c.tc.G.DesktopAppState.Update(mctx, "suspend", nil)
	c.gate.mu.Unlock()
	c.waitMonitor(t)
	require.NoError(t, c.conn.connectNow(uri))
	c.gate.reconnect(context.Background(), context.Background())
	c.requireUp(t, false, "reconnect connected while suspended")
	require.Equal(t, fakeGregorCounts{connects: 2, shutdowns: 2}, c.conn.counts())

	require.NoError(t, c.gate.connect(context.Background(), uri, false))
	c.requireUp(t, false, "connect connected while suspended")
	require.Equal(t, 2, c.conn.counts().connects)

	c.tc.G.DesktopAppState.Update(mctx, "resume", nil)
	c.waitMonitor(t)
	c.requireUp(t, true, "did not connect on resume")
	require.Equal(t, 3, c.conn.counts().connects)
}

func TestGregorConnStress(t *testing.T) {
	tc := libkb.SetupTest(t, "gregorconn", 1)
	defer tc.Cleanup()
	baseline := runtime.NumGoroutine()

	conn := &fakeGregorConn{}
	mobile := &gregorTestAppState{MobileAppState: tc.G.MobileAppState}
	gate := newGregorConnGate(mobile, tc.G.DesktopAppState, conn,
		func(context.Context, string, ...any) {}, func(context.Context) {})
	gate.start()
	c := &gregorConnTest{tc: tc, gate: gate, mobile: mobile, conn: conn}
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
					gate.requestReconnect(ctx, ctx)
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
		// A deadlock leaves the workers holding the gate, so the cleanup that
		// stops the monitor never returns. Nothing this test writes is
		// flushed through that hung unwind, neither t.Fatal's message nor a
		// panic's, so say it on stderr first; go test's own timeout then
		// dumps every stack.
		const msg = "deadlock: transitions and connects did not finish"
		fmt.Fprintln(os.Stderr, msg)
		t.Fatal(msg)
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

// Connects and shutdowns race a reader of the gate's URI and the transport's
// dial. Nothing listens on the port, so OnConnect never runs; this covers the
// gate under -race, not a live connection.
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
			_ = gateURI(h)
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
	require.Equal(t, uri, gateURI(h))
}

func gateURI(h *gregorHandler) *rpc.FMPURI {
	h.connGate.mu.Lock()
	defer h.connGate.mu.Unlock()
	return h.connGate.uri
}

// A connect that fails before it creates a connection, as with no bundled CA
// for the host, leaves nothing running for it, however often it is retried.
func TestGregorHandlerFailedConnectLeavesNothingRunning(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	g.Syncer = chat.NewSyncer(g)
	h := newGregorHandler(g)
	uri, err := rpc.ParseFMPURI("fmprpc+tls://no-bundled-ca.test:443")
	require.NoError(t, err)

	baseline := runtime.NumGoroutine()
	for range 20 {
		require.ErrorContains(t, h.Connect(uri), "No bundled CA")
		h.connGate.reconcile(context.Background())
	}
	require.False(t, hasConn(h))
	deadline := time.Now().Add(10 * time.Second)
	for runtime.NumGoroutine() > baseline && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	require.LessOrEqual(t, runtime.NumGoroutine(), baseline, "a failed connect leaked goroutines")
}

// Everything a connection starts, its ping loop and push state debouncer
// included, exits when it is shut down.
func TestGregorHandlerShutdownStopsConnGoroutines(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	g.Syncer = chat.NewSyncer(g)
	h := newGregorHandler(g)
	uri := closedPortURI(t)

	baseline := runtime.NumGoroutine()
	for range 10 {
		require.NoError(t, h.Connect(uri))
		require.True(t, hasConn(h))
		h.Shutdown(context.Background())
	}
	deadline := time.Now().Add(10 * time.Second)
	for runtime.NumGoroutine() > baseline && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	require.LessOrEqual(t, runtime.NumGoroutine(), baseline, "a shut down connection left goroutines running")
}

// A shut down connection's auth reports loggedInMaybe instead of checking the
// login.
func TestGregorHandlerLoggedInAfterShutdown(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	g.Syncer = chat.NewSyncer(g)
	h := newGregorHandler(g)
	ctx := context.Background()

	_, _, _, _, res := h.loggedIn(ctx)
	require.Equal(t, loggedInNo, res)
	require.NoError(t, h.Connect(closedPortURI(t)))
	_, _, _, _, res = h.loggedIn(ctx)
	require.Equal(t, loggedInNo, res)
	h.Shutdown(ctx)
	_, _, _, _, res = h.loggedIn(ctx)
	require.Equal(t, loggedInMaybe, res)
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

// The service skips Init when gregor is disabled or in Tor mode, so the
// gate's monitor never starts, but a logout still disconnects. It must
// return instead of waiting for anything.
func TestGregorHandlerDisconnectWithoutInit(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	g.Syncer = chat.NewSyncer(g)

	h := newGregorHandler(g)
	done := make(chan error, 1)
	go func() { done <- h.Disconnect() }()
	select {
	case err := <-done:
		require.NoError(t, err)
	case <-time.After(10 * time.Second):
		require.Fail(t, "Disconnect blocked with no Init")
	}
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
	// Bounds on elapsed time rather than on a count in a fixed window, so a
	// slow machine can only make this take longer.
	start, began := a.accepts.Load(), time.Now()
	require.Eventually(t, func() bool { return a.accepts.Load()-start >= 3 }, 10*time.Second, time.Millisecond,
		"ping loop did not redial a failed connection")
	elapsed := time.Since(began)
	t.Logf("3 redials in %v", elapsed)
	require.GreaterOrEqual(t, elapsed, 200*time.Millisecond, "redialing faster than the ping interval")
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

// fakeSyncer ignores a Connected whose ctx is cancelled, as chat.Syncer does.
type fakeSyncer struct {
	types.Syncer
	mu        sync.Mutex
	connected bool
	connects  int
	// onConnected, if set, runs once inside Connected, after the syncer is
	// marked connected, as a logout landing during the sync would.
	onConnected func()
	// onDisconnected, if set, runs once inside Disconnected, after the
	// syncer is marked disconnected.
	onDisconnected func()
}

func (s *fakeSyncer) IsConnected(context.Context) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.connected
}

func (s *fakeSyncer) Connected(ctx context.Context, _ chat1.RemoteInterface, _ gregor1.UID, _ *chat1.SyncChatRes) error {
	s.mu.Lock()
	if err := ctx.Err(); err != nil {
		s.mu.Unlock()
		return err
	}
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
	s.connected = false
	f := s.onDisconnected
	s.onDisconnected = nil
	s.mu.Unlock()
	if f != nil {
		f()
	}
}

func (s *fakeSyncer) connectCalls() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.connects
}

type fakeBadger struct {
	mu     sync.Mutex
	pushes int
	// onPush, if set, runs once inside a push.
	onPush func()
}

func (b *fakeBadger) push() {
	b.mu.Lock()
	b.pushes++
	f := b.onPush
	b.onPush = nil
	b.mu.Unlock()
	if f != nil {
		f()
	}
}

func (b *fakeBadger) PushState(context.Context, gregor.State)                    { b.push() }
func (b *fakeBadger) PushChatFullUpdate(context.Context, chat1.UnreadUpdateFull) { b.push() }

func (b *fakeBadger) count() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.pushes
}

func currentConn(h *gregorHandler) *rpc.Connection {
	h.connMutex.Lock()
	defer h.connMutex.Unlock()
	return h.conn
}

// onConnectCtx returns the ctx OnConnect derives for h's current connection.
func onConnectCtx(t *testing.T, h *gregorHandler) context.Context {
	ctx, cancel, err := h.onConnectCtx(context.Background(), currentConn(h))
	require.NoError(t, err)
	t.Cleanup(cancel)
	return ctx
}

type onConnectTailTest struct {
	h       *gregorHandler
	ctx     context.Context
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
	ctx := onConnectCtx(t, h)
	uid := gregor1.UID(make([]byte, 16))
	gcli, err := h.resetGregorClient(ctx, uid, gregor1.DeviceID(make([]byte, 16)))
	require.NoError(t, err)
	return &onConnectTailTest{
		h: h, ctx: ctx, gcli: gcli, syncer: syncer, badger: badger, uid: uid,
		syncRes: chat1.SyncAllResult{Notification: chat1.NewSyncAllNotificationResWithState(gregor1.State{})},
	}
}

func (c *onConnectTailTest) run(ctx context.Context) error {
	return c.h.onConnectSynced(ctx, chat1.RemoteClient{}, nil, c.uid, c.gcli, c.syncRes)
}

func TestGregorOnConnectTailApplies(t *testing.T) {
	c := setupOnConnectTail(t)
	require.NoError(t, c.run(c.ctx))
	require.Equal(t, 2, c.badger.count())
	require.Len(t, c.h.replayCh, 1)
	require.True(t, c.syncer.IsConnected(context.Background()))
	require.False(t, c.h.isFirstConnect())
	require.False(t, c.h.connectedSince().IsZero())
}

// A tail whose connection a logout has shut down applies nothing.
func TestGregorOnConnectTailAfterLogout(t *testing.T) {
	c := setupOnConnectTail(t)
	require.NoError(t, c.h.Disconnect())
	require.ErrorIs(t, c.run(c.ctx), chat.ErrDuplicateConnection)
	require.Zero(t, c.badger.count(), "badges pushed after logout")
	require.Zero(t, c.syncer.connectCalls(), "chat sync ran after logout")
	require.Empty(t, c.h.replayCh, "gregor state sync ran after logout")
	require.True(t, c.h.isFirstConnect(), "first connect cleared after logout")
	require.True(t, c.h.connectedSince().IsZero(), "connected time set after logout")
}

// A logout during the chat sync leaves the syncer disconnected and stops the
// rest of the tail.
func TestGregorOnConnectLogoutDuringChatSync(t *testing.T) {
	c := setupOnConnectTail(t)
	c.syncer.onConnected = func() { require.NoError(t, c.h.Disconnect()) }
	require.ErrorIs(t, c.run(c.ctx), chat.ErrDuplicateConnection)
	require.False(t, c.syncer.IsConnected(context.Background()), "syncer left connected after logout")
	require.Equal(t, 1, c.badger.count(), "badges pushed after logout")
	require.Empty(t, c.h.replayCh, "gregor state sync ran after logout")
	require.True(t, c.h.isFirstConnect(), "first connect cleared after logout")
	require.True(t, c.h.connectedSince().IsZero(), "connected time set after logout")
}

// A Shutdown that lands between the gregor badge push and the connected
// step leaves first connect and the connected time alone. A real Shutdown
// can't land during the push, which holds the gate, so the push cancels the
// connection's ctx as that Shutdown would.
func TestGregorOnConnectShutdownBeforeConnectedStep(t *testing.T) {
	c := setupOnConnectTail(t)
	c.badger.onPush = func() {
		c.badger.mu.Lock()
		defer c.badger.mu.Unlock()
		c.badger.onPush = func() {
			c.h.connMutex.Lock()
			defer c.h.connMutex.Unlock()
			c.h.connCancel()
		}
	}
	require.ErrorIs(t, c.run(c.ctx), chat.ErrDuplicateConnection)
	require.Equal(t, 2, c.badger.count())
	require.True(t, c.h.isFirstConnect(), "first connect cleared after shutdown")
	require.True(t, c.h.connectedSince().IsZero(), "connected time set after shutdown")
}

// Shutdown cancels OnConnect's ctx before it marks the syncer disconnected,
// so a Syncer.Connected from that OnConnect landing just after the mark is
// ignored rather than leaving the syncer connected.
func TestGregorShutdownCancelsBeforeSyncerDisconnected(t *testing.T) {
	c := setupOnConnectTail(t)
	c.syncer.onDisconnected = func() {
		_ = c.syncer.Connected(c.ctx, chat1.RemoteClient{}, c.uid, &chat1.SyncChatRes{})
	}
	require.NoError(t, c.h.Disconnect())
	require.False(t, c.syncer.IsConnected(context.Background()), "syncer connected after shutdown")
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
	require.ErrorIs(t, c.run(c.ctx), chat.ErrDuplicateConnection)
	<-logoutDone
	require.Equal(t, 1, c.badger.count())
}

// reinstall makes conn the current connection again, as connectNow would,
// so the next tail run is not short-circuited by the logout before it. No
// dial is involved, so no connection callback races this.
func (c *onConnectTailTest) reinstall(conn *rpc.Connection) {
	c.h.connMutex.Lock()
	defer c.h.connMutex.Unlock()
	c.h.conn = conn
	c.h.connCtx, c.h.connCancel = context.WithCancel(context.Background())
}

// OnConnect's tail, a logout and app state transitions all run under the
// connection gate. Racing them must not deadlock, and a logout must still
// leave gregor down.
func TestGregorOnConnectTailStress(t *testing.T) {
	c := setupOnConnectTail(t)
	// Swap in a connection that never dials. This test puts the current
	// connection back after each logout, and a dialing one would reconnect
	// behind it and outlive the test.
	require.NoError(t, c.h.Disconnect())
	conn := &rpc.Connection{}
	c.reinstall(conn)
	c.h.connGate.start()
	t.Cleanup(c.h.connGate.stop)

	stop := make(chan struct{})
	var tails, writers sync.WaitGroup
	for range 2 {
		tails.Add(1)
		go func() {
			defer tails.Done()
			for {
				select {
				case <-stop:
					return
				default:
				}
				c.reinstall(conn)
				// Another tail's logout can land before the ctx is derived.
				if ctx, cancel, err := c.h.onConnectCtx(context.Background(), conn); err == nil {
					_ = c.run(ctx)
					cancel()
				}
				// A run queues at most one replay, and Init's replay thread
				// is not running here to take it off.
				select {
				case <-c.h.replayCh:
				default:
				}
				_ = c.h.Disconnect()
				runtime.Gosched()
			}
		}()
	}
	for w := range 2 {
		writers.Add(1)
		go func() {
			defer writers.Done()
			rng := rand.New(rand.NewSource(int64(w)))
			for range 500 {
				c.h.G().MobileAppState.Update(allAppStates[rng.Intn(len(allAppStates))])
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
		tails.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(60 * time.Second):
		// A deadlock leaves the racers holding the handler's locks, so the
		// cleanup that shuts the handler down never returns. Nothing this
		// test writes is flushed through that hung unwind, neither t.Fatal's
		// message nor a panic's, so say it on stderr first; go test's own
		// timeout then dumps every stack.
		const msg = "deadlock: the connect tail, logouts and transitions did not finish"
		fmt.Fprintln(os.Stderr, msg)
		t.Fatal(msg)
	}

	require.NoError(t, c.h.Disconnect())
	require.False(t, hasConn(c.h), "logout left a connection after settling")
	c.h.G().MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	c.h.connGate.reconcile(context.Background())
	require.False(t, hasConn(c.h), "reconnected after a logout")
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

// An OnConnect for a connection that is no longer current, because it shut
// down before OnConnect started or while it ran, or because a newer
// connection replaced it, installs no gregor client, leaves the chat syncer
// alone, and fails with an error the connection does not retry. The rpc
// library hands a replaced connection's OnConnect a live ctx.
func TestGregorOnConnectAfterShutdownInstallsNothing(t *testing.T) {
	for _, tt := range []struct {
		name string
		// before runs before OnConnect, during inside it, after the
		// connection check.
		before, during func(t *testing.T, h *gregorHandler, uri *rpc.FMPURI)
	}{
		{name: "before", before: func(t *testing.T, h *gregorHandler, _ *rpc.FMPURI) {
			require.NoError(t, h.Disconnect())
		}},
		{name: "during", during: func(t *testing.T, h *gregorHandler, _ *rpc.FMPURI) {
			require.NoError(t, h.Disconnect())
		}},
		{name: "replaced", before: func(t *testing.T, h *gregorHandler, uri *rpc.FMPURI) {
			require.NoError(t, h.Disconnect())
			require.NoError(t, h.Connect(uri))
		}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			tc, g := setupGregorTest(t)
			defer tc.Cleanup()
			syncer := &fakeSyncer{}
			g.Syncer = syncer
			h := newGregorHandler(g)
			uri := closedPortURI(t)
			require.NoError(t, h.Connect(uri))
			defer h.Shutdown(context.Background())
			conn := currentConn(h)

			h.authParamsForTest = func(context.Context) (gregor1.UID, gregor1.DeviceID, gregor1.SessionToken, *libkb.NIST, error) {
				if tt.during != nil {
					tt.during(t, h, uri)
				}
				return gregor1.UID(make([]byte, 16)), gregor1.DeviceID(make([]byte, 16)), "", nil, nil
			}
			if tt.before != nil {
				tt.before(t, h, uri)
			}

			local, remote := net.Pipe()
			defer remote.Close()
			xp := rpc.NewTransport(local, libkb.NewRPCLogFactory(tc.G), tc.G.RemoteNetworkInstrumenterStorage,
				libkb.MakeWrapError(tc.G), rpc.DefaultMaxFrameLength)
			defer xp.Close()
			srv := rpc.NewServer(xp, libkb.MakeWrapError(tc.G))

			err := h.OnConnect(context.Background(), conn, failingRPCClient{}, srv)
			require.ErrorIs(t, err, chat.ErrDuplicateConnection)
			require.False(t, h.ShouldRetryOnConnect(err), "retrying a connection that is not current")
			_, err = h.getGregorCli()
			require.Error(t, err, "installed a client for a connection that is not current")
			require.Zero(t, syncer.connectCalls(), "chat sync ran for a connection that is not current")
		})
	}
}

// syncAllRecorder fails every call, recording the host of each SyncAll.
type syncAllRecorder struct {
	failingRPCClient
	mu    sync.Mutex
	hosts []string
}

func (r *syncAllRecorder) CallCompressed(_ context.Context, _ string, arg any, _ any, _ rpc.CompressionType, _ time.Duration) error {
	if args, ok := arg.([]any); ok && len(args) == 1 {
		if sa, ok := args[0].(chat1.SyncAllArg); ok {
			r.mu.Lock()
			r.hosts = append(r.hosts, sa.HostName)
			r.mu.Unlock()
		}
	}
	return errors.New("no server")
}

// OnConnect sends the host of the uri the gate connected to.
func TestGregorOnConnectSyncAllHost(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	g.Syncer = &fakeSyncer{}
	h := newGregorHandler(g)
	uri := closedPortURI(t)
	require.NoError(t, h.Connect(uri))
	defer h.Shutdown(context.Background())
	h.authParamsForTest = func(context.Context) (gregor1.UID, gregor1.DeviceID, gregor1.SessionToken, *libkb.NIST, error) {
		return gregor1.UID(make([]byte, 16)), gregor1.DeviceID(make([]byte, 16)), "", nil, nil
	}

	local, remote := net.Pipe()
	defer remote.Close()
	xp := rpc.NewTransport(local, libkb.NewRPCLogFactory(tc.G), tc.G.RemoteNetworkInstrumenterStorage,
		libkb.MakeWrapError(tc.G), rpc.DefaultMaxFrameLength)
	defer xp.Close()
	srv := rpc.NewServer(xp, libkb.MakeWrapError(tc.G))

	rec := &syncAllRecorder{}
	err := h.OnConnect(context.Background(), currentConn(h), rec, srv)
	require.ErrorContains(t, err, "error running SyncAll")
	rec.mu.Lock()
	defer rec.mu.Unlock()
	require.Equal(t, []string{uri.Host}, rec.hosts)
}

// A reconnect for a connection that has since been shut down does nothing:
// run directly, or queued before the replacement and run by the monitor.
func TestGregorConnReconnectSkipsReplacedConn(t *testing.T) {
	c := setupGregorConn(t, keybase1.MobileAppState_FOREGROUND)
	c.waitMonitor(t)
	require.NoError(t, c.gate.connect(context.Background(), testGregorURI(t, "gregord.test"), false))
	want := fakeGregorCounts{up: true, connects: 1}

	replaced, cancel := context.WithCancel(context.Background())
	cancel()
	c.gate.reconnect(context.Background(), replaced)
	c.gate.reconnect(context.Background(), nil)
	require.Equal(t, want, c.conn.counts(), "reconnected a replaced connection")

	queued, cancelQueued := context.WithCancel(context.Background())
	c.gate.mu.Lock()
	c.gate.requestReconnect(context.Background(), queued)
	cancelQueued()
	c.gate.mu.Unlock()
	require.Eventually(t, func() bool { return len(c.gate.reconnectCh) == 0 }, 10*time.Second, time.Millisecond)
	c.waitMonitor(t)
	require.Equal(t, want, c.conn.counts(), "a queued reconnect tore down a newer connection")

	// A request for a replaced connection does not displace a pending one
	// for the live connection.
	c.gate.mu.Lock()
	c.gate.requestReconnect(context.Background(), context.Background())
	c.gate.requestReconnect(context.Background(), replaced)
	c.gate.mu.Unlock()
	want = fakeGregorCounts{up: true, connects: 2, shutdowns: 1}
	require.Eventually(t, func() bool { return c.conn.counts() == want }, 10*time.Second, time.Millisecond,
		"the live connection's reconnect was dropped")
}

// OnDisconnected from a connection that has been shut down, as a reconnect
// loop started on it after Shutdown reports, leaves the current connection's
// state alone.
func TestGregorOnDisconnectedIgnoresReplacedConn(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	syncer := &fakeSyncer{}
	g.Syncer = syncer
	h := newGregorHandler(g)
	// No real connection, whose own reconnect loop would report too.
	h.connCtx, h.connCancel = context.WithCancel(context.Background())
	defer h.connCancel()
	markConnected := func() {
		syncer.mu.Lock()
		syncer.connected = true
		syncer.mu.Unlock()
		h.setConnectedAt(time.Now())
	}

	replaced, cancel := context.WithCancel(context.Background())
	cancel()
	markConnected()
	(&gregorConnHandler{gregorHandler: h, connCtx: replaced}).OnDisconnected(context.Background(),
		rpc.StartingNonFirstConnection)
	require.True(t, syncer.IsConnected(context.Background()), "a replaced connection marked the syncer offline")
	require.False(t, h.connectedSince().IsZero(), "a replaced connection cleared connectedAt")

	(&gregorConnHandler{gregorHandler: h, connCtx: h.currentConnCtx()}).OnDisconnected(context.Background(),
		rpc.StartingNonFirstConnection)
	require.False(t, syncer.IsConnected(context.Background()), "the current connection did not mark the syncer offline")
	require.True(t, h.connectedSince().IsZero(), "the current connection did not clear connectedAt")
}

// A replay queued for a user who has since logged out does not run.
func TestGregorReplaySkipsLoggedOutUser(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	h := newGregorHandler(g)
	h.testingEvents = newTestingEvents()
	go h.syncReplayThread()
	defer close(h.replayCh)

	h.replayCh <- replayThreadArg{ctx: context.Background(), uid: gregor1.UID(make([]byte, 16))}
	select {
	case res := <-h.testingEvents.replayThreadCh:
		require.NoError(t, res.err, "replayed for a logged-out user")
		require.Empty(t, res.replayed)
	case <-time.After(10 * time.Second):
		t.Fatal("replay thread did not report")
	}
}
