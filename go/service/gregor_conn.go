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
// also runs the steps OnConnect applies after syncing (see do), so none of
// them interleaves with a disconnect.
//
// This is a mutex gate rather than a single owning goroutine like
// kbhttp/manager's Srv: every operation here is synchronous with a result its
// caller needs (connect/reconnect return errors, reconnect also didShutdown),
// and do's OnConnect steps must report "no longer current" back on the
// caller's goroutine so onConnectSynced can return ErrDuplicateConnection. A
// request-channel loop would need a reply channel per request -- more code and
// more states -- so do not harmonise the two shapes.
type gregorConnGate struct {
	mobile       gregorAppState
	desktop      *libkb.DesktopAppState
	conn         gregorConnector
	debug        func(ctx context.Context, format string, args ...any)
	onForeground func(ctx context.Context)

	mu sync.Mutex
	// uri is the last URI a connect asked for. It is kept when the connect is
	// held back in BACKGROUND, so the monitor connects once the app leaves
	// BACKGROUND.
	uri *rpc.FMPURI
	// The monitor's last seen states and the change channels it waits on for
	// them; tests use them to wait until the monitor has caught up.
	monitorState       keybase1.MobileAppState
	monitorSuspended   bool
	monitorWait        <-chan struct{}
	monitorSuspendWait <-chan struct{}

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
		stopCh:       make(chan struct{}),
		monitorDone:  make(chan struct{}),
	}
}

func (c *gregorConnGate) canConnect(state keybase1.MobileAppState) bool {
	return state != keybase1.MobileAppState_BACKGROUND
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

// connect connects to uri unless the app is in BACKGROUND. With reset, any
// existing connection is reset first so it authenticates again; that
// includes one that is not connected, such as one whose auth failed while
// logged out, which would otherwise keep connectNow from dialing.
func (c *gregorConnGate) connect(ctx context.Context, uri *rpc.FMPURI, reset bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.uri = uri
	if reset {
		if err := c.conn.Reset(); err != nil {
			return err
		}
	}
	state := c.mobile.State()
	if !c.canConnect(state) {
		c.debug(ctx, "connect: not connecting in %v", state)
		return nil
	}
	return c.conn.connectNow(uri)
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

// reconnect drops a live connection and connects again, unless the app is
// now in BACKGROUND. didShutdown reports whether a connection was dropped.
func (c *gregorConnGate) reconnect(ctx context.Context) (didShutdown bool, err error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.conn.IsConnected() {
		c.debug(ctx, "Reconnect: skipping reconnect, already disconnected")
		return false, nil
	}
	c.debug(ctx, "Reconnect: reconnecting to server")
	c.conn.Shutdown(ctx)
	if state := c.mobile.State(); !c.canConnect(state) {
		c.debug(ctx, "Reconnect: not connecting in %v", state)
		return true, nil
	}
	return true, c.conn.connectNow(c.uri)
}

func (c *gregorConnGate) reconcile(ctx context.Context) {
	c.mu.Lock()
	defer c.mu.Unlock()
	state, suspended := c.mobile.State(), c.desktop.Suspended()
	if !c.canConnect(state) || suspended {
		c.debug(ctx, "reconcile: disconnecting in %v (suspended: %v)", state, suspended)
		c.conn.Shutdown(ctx)
		return
	}
	// Nothing asked to connect yet, for example before login.
	if c.uri == nil {
		return
	}
	c.debug(ctx, "reconcile: connecting in %v", state)
	if err := c.conn.connectNow(c.uri); err != nil {
		c.debug(ctx, "reconcile: error connecting: %s", err)
	}
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
