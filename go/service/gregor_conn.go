package service

import (
	"context"
	"sync"
	"sync/atomic"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// gregorConnector is the connection gregorConnGate drives: the gregor
// handler, or a fake in tests.
type gregorConnector interface {
	// connectNow connects to uri, doing nothing if already connected. A
	// cancelled connection is replaced.
	connectNow(uri *rpc.FMPURI) error
	// cancel cancels the current connection's ctx without shutting it down.
	cancel()
	// Shutdown disconnects, doing nothing if not connected.
	Shutdown(ctx context.Context)
	Reset() error
	IsConnected() bool
}

// gregorAppState is the mobile app state the gate follows, as an interface so
// it can be substituted: tests wrap the real one to act between a connect's
// state read and what the connect does with it.
type gregorAppState interface {
	State() keybase1.MobileAppState
	NextUpdate(lastState keybase1.MobileAppState) <-chan struct{}
}

// gregorConnGate decides when gregor is connected. Only BACKGROUND, or a
// desktop suspend, takes the connection down; INACTIVE keeps it up.
//
// Every connect and the monitor read the app state and act on it under mu.
// A BACKGROUND that lands after a connect read the state wakes the monitor,
// which then waits for that connect before taking the connection down. mu
// also runs everything OnConnect applies after SyncAll (onConnectSynced holds
// it throughout), so none of it interleaves with a disconnect, and guards the
// uri OnConnect reads. A BACKGROUND, a desktop suspend or a logout cancels the
// connection before taking mu, so it waits only for an OnConnect that is
// already unwinding.
//
// This is a mutex gate rather than a single owning goroutine like
// kbhttp/manager's Srv: connect and forget return errors their callers need,
// and OnConnect must learn on its own goroutine that its connection is no
// longer current so it can return ErrDuplicateConnection. A request-channel
// loop would need a reply channel per request -- more code and more states --
// so do not harmonise the two shapes.
type gregorConnGate struct {
	mobile       gregorAppState
	desktop      *libkb.DesktopAppState
	conn         gregorConnector
	debug        func(ctx context.Context, format string, args ...any)
	onForeground func(ctx context.Context)

	mu sync.Mutex
	// uri is the last URI a connect asked for. It is kept when the connect is
	// held back by BACKGROUND or a desktop suspend, so the monitor connects
	// once that ends.
	uri *rpc.FMPURI
	// The monitor's last seen states and the change channels it waits on for
	// them; tests use them to wait until the monitor has caught up.
	monitorState       keybase1.MobileAppState
	monitorSuspended   bool
	monitorWait        <-chan struct{}
	monitorSuspendWait <-chan struct{}

	// reconnectPending is set while a requested reconnect waits for mu.
	reconnectPending atomic.Bool
	// reconcileCh has the monitor reconcile.
	reconcileCh chan struct{}

	startOnce   sync.Once
	stopOnce    sync.Once
	stopCh      chan struct{}
	monitorDone chan struct{}
}

func newGregorConnGate(mobile gregorAppState, desktop *libkb.DesktopAppState, conn gregorConnector,
	debug func(ctx context.Context, format string, args ...any), onForeground func(ctx context.Context),
) *gregorConnGate {
	return &gregorConnGate{
		mobile:       mobile,
		desktop:      desktop,
		conn:         conn,
		debug:        debug,
		onForeground: onForeground,
		reconcileCh:  make(chan struct{}, 1),
		stopCh:       make(chan struct{}),
		monitorDone:  make(chan struct{}),
	}
}

// start reconciles against the current state and starts the monitor.
func (c *gregorConnGate) start() {
	c.startOnce.Do(func() {
		ctx := libkb.WithLogTag(context.Background(), "GRGRMON")
		state, suspended := c.mobile.State(), c.desktop.Suspended()
		c.debug(ctx, "monitorAppState: starting up in %v (suspended: %v)", state, suspended)
		c.reconcile(ctx)
		go c.monitor(ctx, state, suspended)
		go c.cancelWhileDown(state, suspended)
	})
}

// stop tells the monitor to exit, without waiting for it. It does not
// disconnect.
func (c *gregorConnGate) stop() {
	c.stopOnce.Do(func() { close(c.stopCh) })
}

// connect connects to uri when reconcile allows it. With reset, any existing
// connection is reset first so it authenticates again; that includes one that
// is not connected, such as one whose auth failed while logged out, which
// would otherwise keep connectNow from dialing.
func (c *gregorConnGate) connect(ctx context.Context, uri *rpc.FMPURI, reset bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.uri = uri
	if reset {
		if err := c.conn.Reset(); err != nil {
			return err
		}
	}
	return c.reconcileLocked(ctx)
}

// forget resets the connection and drops the uri, so nothing reconnects until
// the next connect.
func (c *gregorConnGate) forget(ctx context.Context) error {
	c.conn.cancel()
	c.mu.Lock()
	defer c.mu.Unlock()
	c.debug(ctx, "forget: resetting and forgetting the uri")
	c.uri = nil
	return c.conn.Reset()
}

// requestReconnect reconnects without waiting. Requests made while one waits
// for mu are merged into it.
func (c *gregorConnGate) requestReconnect(ctx context.Context) {
	if !c.reconnectPending.CompareAndSwap(false, true) {
		c.debug(ctx, "Reconnect: merged into a pending reconnect")
		return
	}
	go c.reconnect(libkb.CopyTagsToBackground(ctx))
}

// reconnect drops a live connection and connects again when reconcile allows
// it.
func (c *gregorConnGate) reconnect(ctx context.Context) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.reconnectPending.Store(false)
	if !c.conn.IsConnected() {
		c.debug(ctx, "Reconnect: skipping reconnect, already disconnected")
		return
	}
	c.debug(ctx, "Reconnect: reconnecting to server")
	c.conn.Shutdown(ctx)
	if err := c.reconcileLocked(ctx); err != nil {
		c.debug(ctx, "Reconnect: error connecting: %s", err)
	}
}

func (c *gregorConnGate) reconcile(ctx context.Context) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.reconcileLocked(ctx); err != nil {
		c.debug(ctx, "reconcile: error connecting: %s", err)
	}
}

// keepsDown reports whether no connection may exist in state.
func keepsDown(state keybase1.MobileAppState, suspended bool) bool {
	return state == keybase1.MobileAppState_BACKGROUND || suspended
}

// reconcileLocked is the only place that decides whether a connection may
// exist: none in BACKGROUND or while the desktop is suspended, otherwise one
// to the uri, if any. c.mu must be held.
func (c *gregorConnGate) reconcileLocked(ctx context.Context) error {
	state, suspended := c.mobile.State(), c.desktop.Suspended()
	if keepsDown(state, suspended) {
		c.debug(ctx, "reconcile: disconnecting in %v (suspended: %v)", state, suspended)
		c.conn.Shutdown(ctx)
		return nil
	}
	// Nothing asked to connect yet, for example before login.
	if c.uri == nil {
		return nil
	}
	c.debug(ctx, "reconcile: connecting in %v", state)
	return c.conn.connectNow(c.uri)
}

func (c *gregorConnGate) monitor(ctx context.Context, state keybase1.MobileAppState, suspended bool) {
	defer close(c.monitorDone)
	for {
		next := c.mobile.NextUpdate(state)
		nextSuspend := c.desktop.NextSuspendUpdate(suspended)
		c.mu.Lock()
		c.monitorState, c.monitorSuspended = state, suspended
		c.monitorWait, c.monitorSuspendWait = next, nextSuspend
		c.mu.Unlock()
		select {
		case <-next:
		case <-nextSuspend:
		case <-c.reconcileCh:
		case <-c.stopCh:
			return
		}
		prev := state
		state, suspended = c.mobile.State(), c.desktop.Suspended()
		if state != prev && state == keybase1.MobileAppState_FOREGROUND {
			c.onForeground(ctx)
		}
		c.reconcile(ctx)
	}
}

// cancelWhileDown cancels the connection on every change to a state that
// keeps it down, without mu, so the monitor's reconcile finds any OnConnect
// holding mu already unwinding. It is not part of the monitor, which may
// itself be waiting for mu when the change lands.
func (c *gregorConnGate) cancelWhileDown(state keybase1.MobileAppState, suspended bool) {
	for {
		next := c.mobile.NextUpdate(state)
		nextSuspend := c.desktop.NextSuspendUpdate(suspended)
		select {
		case <-next:
		case <-nextSuspend:
		case <-c.stopCh:
			return
		}
		state, suspended = c.mobile.State(), c.desktop.Suspended()
		if keepsDown(state, suspended) {
			c.cancelAndReconcile()
		}
	}
}

// cancelAndReconcile cancels the connection and has the monitor reconcile
// after that, which shuts it down or, if the state has come back up since it
// was read, replaces it. The monitor may already have connected for that
// later state, and nothing else would follow the cancel.
func (c *gregorConnGate) cancelAndReconcile() {
	c.conn.cancel()
	select {
	case c.reconcileCh <- struct{}{}:
	default:
	}
}
