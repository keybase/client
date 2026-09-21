package service

import (
	"context"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// gregorConnector is the connection gregorConnGate drives: the gregor
// handler, or a fake in tests.
type gregorConnector interface {
	// connectNow connects to uri, doing nothing if already connected.
	connectNow(uri *rpc.FMPURI) error
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
// also runs the steps OnConnect applies after syncing (the handler takes it in
// onGateIfCurrent), so none of them interleaves with a disconnect, and guards
// the uri OnConnect reads.
//
// This is a mutex gate rather than a single owning goroutine like
// kbhttp/manager's Srv: connect and forget return errors their callers need,
// and the OnConnect steps must report "no longer current" back on the caller's
// goroutine so onConnectSynced can return ErrDuplicateConnection. A
// request-channel loop would need a reply channel per request -- more code and
// more states -- so do not harmonise the two shapes. Only reconnect, whose
// callers need no result, is a request the monitor runs.
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

	// reconnectCh holds at most one reconnect request for the monitor, so a
	// burst of requests coalesces.
	reconnectCh chan struct{}

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
		reconnectCh:  make(chan struct{}, 1),
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
	c.mu.Lock()
	defer c.mu.Unlock()
	c.debug(ctx, "forget: resetting and forgetting the uri")
	c.uri = nil
	return c.conn.Reset()
}

// requestReconnect asks the monitor to reconnect and returns without waiting.
func (c *gregorConnGate) requestReconnect(ctx context.Context) {
	select {
	case c.reconnectCh <- struct{}{}:
		c.debug(ctx, "Reconnect: requested")
	default:
		c.debug(ctx, "Reconnect: one is already pending")
	}
}

// reconnect drops a live connection and connects again when reconcile allows
// it.
func (c *gregorConnGate) reconnect(ctx context.Context) {
	c.mu.Lock()
	defer c.mu.Unlock()
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

// reconcileLocked is the only place that decides whether a connection may
// exist: none in BACKGROUND or while the desktop is suspended, otherwise one
// to the uri, if any. c.mu must be held.
func (c *gregorConnGate) reconcileLocked(ctx context.Context) error {
	state, suspended := c.mobile.State(), c.desktop.Suspended()
	if state == keybase1.MobileAppState_BACKGROUND || suspended {
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
		case <-c.reconnectCh:
			c.reconnect(ctx)
			continue
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
