package libkb

import (
	"fmt"
	"runtime"
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// alreadyClosed is a shared close-only channel returned from NextUpdate /
// NextNetworkStateUpdate / NextSuspendUpdate when the caller's lastState is
// stale relative to the current state. Since receiving from a closed
// chan struct{} is safe and idempotent, a single sentinel serves any number of
// concurrent callers without allocation.
var alreadyClosed = func() chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}()

// MobileAppState tracks the state of foreground/background status of the app
// in which the service is running in.
type MobileAppState struct {
	Contextified
	sync.Mutex
	state keybase1.MobileAppState
	// changed is closed and replaced whenever state actually changes. Any
	// caller holding a reference to the previous channel is woken by the
	// close; they then re-read State() to see the new value.
	changed chan struct{}

	// mtime is the time at which the appstate first switched to the current state.
	// It is a monotonic timestamp and should only be used relatively.
	mtime *time.Time
}

func NewMobileAppState(g *GlobalContext) *MobileAppState {
	state := keybase1.MobileAppState_FOREGROUND
	if runtime.GOOS == "android" {
		// we need this so cold notifications work on android
		state = keybase1.MobileAppState_BACKGROUNDACTIVE
	}
	return &MobileAppState{
		Contextified: NewContextified(g),
		state:        state,
		changed:      make(chan struct{}),
	}
}

// NextUpdate returns a channel that will be closed the next time the app
// state changes. If lastState does not match the current state, an
// already-closed channel is returned so the caller wakes immediately and can
// re-fetch via State().
//
// Note: state transitions between two NextUpdate calls may be collapsed - a
// caller is guaranteed only that when the returned channel fires, State()
// returns a value different from the one they last observed; they are not
// guaranteed to observe every intermediate transition.
func (a *MobileAppState) NextUpdate(lastState keybase1.MobileAppState) <-chan struct{} {
	a.Lock()
	defer a.Unlock()
	if lastState != a.state {
		return alreadyClosed
	}
	return a.changed
}

func (a *MobileAppState) updateLocked(state keybase1.MobileAppState) {
	if a.state != state {
		a.G().Log.Debug("MobileAppState.Update: useful update: %v, we are currently in state: %v",
			state, a.state)
		a.G().PerfLog.Debug("MobileAppState.Update: useful update: %v, we are currently in state: %v",
			state, a.state)
		a.state = state
		t := time.Now()
		a.mtime = &t // only update mtime if we're changing state
		close(a.changed)
		a.changed = make(chan struct{})

		// cancel RPCs if we go into the background
		switch a.state {
		case keybase1.MobileAppState_BACKGROUND:
			a.G().RPCCanceler.CancelLiveContexts(RPCCancelerReasonBackground)
		default:
			// Nothing to do for other states.
		}
	} else {
		a.G().Log.Debug("MobileAppState.Update: ignoring update: %v, we are currently in state: %v",
			state, a.state)
	}
}

func (a *MobileAppState) UpdateWithCheck(state keybase1.MobileAppState,
	check func(keybase1.MobileAppState) bool,
) {
	defer a.G().Trace(fmt.Sprintf("MobileAppState.UpdateWithCheck(%v)", state), nil)()
	a.Lock()
	defer a.Unlock()
	if check(a.state) {
		a.updateLocked(state)
	} else {
		a.G().Log.Debug("MobileAppState.UpdateWithCheck: skipping update, failed check")
	}
}

// Update updates the current app state, and notifies any waiting calls from NextUpdate
func (a *MobileAppState) Update(state keybase1.MobileAppState) {
	defer a.G().Trace(fmt.Sprintf("MobileAppState.Update(%v)", state), nil)()
	a.Lock()
	defer a.Unlock()
	a.updateLocked(state)
}

// State returns the current app state
func (a *MobileAppState) State() keybase1.MobileAppState {
	a.Lock()
	defer a.Unlock()
	return a.state
}

func (a *MobileAppState) StateAndMtime() (keybase1.MobileAppState, *time.Time) {
	a.Lock()
	defer a.Unlock()
	return a.state, a.mtime
}

// --------------------------------------------------

// MobileNetState tracks the state of the network status of the app in which
// the service is running in.
type MobileNetState struct {
	Contextified
	sync.Mutex
	state keybase1.MobileNetworkState
	// changed is closed and replaced whenever state actually changes.
	changed chan struct{}
}

func NewMobileNetState(g *GlobalContext) *MobileNetState {
	return &MobileNetState{
		Contextified: NewContextified(g),
		state:        keybase1.MobileNetworkState_NOTAVAILABLE,
		changed:      make(chan struct{}),
	}
}

// NextUpdate returns a channel that will be closed the next time the network
// state changes. If lastState does not match the current state, an
// already-closed channel is returned so the caller wakes immediately.
func (a *MobileNetState) NextUpdate(lastState keybase1.MobileNetworkState) <-chan struct{} {
	a.Lock()
	defer a.Unlock()
	if lastState != a.state {
		return alreadyClosed
	}
	return a.changed
}

// Update updates the current network state, and notifies any waiting calls
// from NextUpdate
func (a *MobileNetState) Update(state keybase1.MobileNetworkState) {
	defer a.G().Trace(fmt.Sprintf("MobileNetState.Update(%v)", state), nil)()
	a.Lock()
	defer a.Unlock()
	if a.state != state {
		a.G().Log.Debug("MobileNetState.Update: useful update: %v, we are currently in state: %v",
			state, a.state)
		a.state = state
		close(a.changed)
		a.changed = make(chan struct{})
	} else {
		a.G().Log.Debug("MobileNetState.Update: ignoring update: %v, we are currently in state: %v",
			state, a.state)
	}
}

// State returns the current network state
func (a *MobileNetState) State() keybase1.MobileNetworkState {
	a.Lock()
	defer a.Unlock()
	return a.state
}

// --------------------------------------------------

const (
	// wakeWatchInterval is how often the wake watcher samples the wall clock.
	wakeWatchInterval = 10 * time.Second
	// wakeWatchGap is the wall-clock gap between samples that we take to mean
	// the machine was asleep.
	wakeWatchGap = 30 * time.Second
	// wakeQuarantine is how long after an unexplained wake AwakeAndUnlocked
	// keeps reporting false.
	wakeQuarantine = 60 * time.Second
)

type DesktopAppState struct {
	Contextified
	sync.Mutex
	provider  rpc.Transporter
	suspended bool
	locked    bool
	// suspendChanged is closed and replaced whenever suspended actually
	// changes; readers wake and re-read Suspended().
	suspendChanged  chan struct{}
	wakeWatcherOnce sync.Once
	wakeWatcherStop chan struct{}
	// wokeAt is the last time the wake watcher saw the machine come back from
	// sleep without a corresponding power event (dark wake, lost "suspend"
	// event, or no GUI connected to send one).
	wokeAt time.Time
}

func NewDesktopAppState(g *GlobalContext) *DesktopAppState {
	d := &DesktopAppState{
		Contextified:    NewContextified(g),
		suspendChanged:  make(chan struct{}),
		wakeWatcherStop: make(chan struct{}),
	}
	g.PushShutdownHook(func(mctx MetaContext) error {
		d.Lock()
		defer d.Unlock()
		// reset power state on shutdown
		d.resetLocked()
		select {
		case <-d.wakeWatcherStop:
		default:
			close(d.wakeWatcherStop)
		}
		return nil
	})
	return d
}

// StartWakeWatcher spawns a loop that detects the machine sleeping when no
// "suspend" power event told us about it: the event lost a race with sleep,
// or no Electron GUI is connected to send power events at all. Detection is
// a wall-clock gap between samples; anything past wakeWatchGap means we were
// suspended.
func (a *DesktopAppState) StartWakeWatcher() {
	a.wakeWatcherOnce.Do(func() {
		go a.wakeWatchLoop()
	})
}

func (a *DesktopAppState) wakeWatchLoop() {
	// Round(0) strips the monotonic reading so Sub measures wall-clock time,
	// which keeps advancing across sleeps regardless of platform monotonic
	// clock behavior.
	last := time.Now().Round(0)
	for {
		select {
		case <-time.After(wakeWatchInterval):
		case <-a.wakeWatcherStop:
			return
		}
		now := time.Now().Round(0)
		if gap := now.Sub(last); gap > wakeWatchGap {
			a.G().Log.Debug("DesktopAppState: wake with no power event, gap %v", gap)
			a.Lock()
			a.wokeAt = now
			a.Unlock()
		}
		last = now
	}
}

// NextSuspendUpdate returns a channel that will be closed the next time the
// suspend state changes. If lastState does not match the current suspend
// state, an already-closed channel is returned so the caller wakes
// immediately and can re-fetch via Suspended().
func (a *DesktopAppState) NextSuspendUpdate(lastState bool) <-chan struct{} {
	a.Lock()
	defer a.Unlock()
	if lastState != a.suspended {
		return alreadyClosed
	}
	return a.suspendChanged
}

// Suspended returns the current suspended state.
func (a *DesktopAppState) Suspended() bool {
	a.Lock()
	defer a.Unlock()
	return a.suspended
}

// event from power monitor
// https://electronjs.org/docs/api/power-monitor
func (a *DesktopAppState) Update(mctx MetaContext, event string, provider rpc.Transporter) {
	mctx.Debug("DesktopAppState.Update(%v)", event)
	a.Lock()
	defer a.Unlock()
	a.provider = provider
	prevSuspended := a.suspended
	switch event {
	case "suspend":
		a.suspended = true
	case "resume":
		a.suspended = false
		// a power event arrived for this wake, so it's a real resume with the
		// GUI alive, not a dark wake.
		a.wokeAt = time.Time{}
	case "shutdown":
	case "lock-screen":
		a.locked = true
	case "unlock-screen":
		a.suspended = false
		a.locked = false
		a.wokeAt = time.Time{}
	}
	if a.suspended != prevSuspended {
		close(a.suspendChanged)
		a.suspendChanged = make(chan struct{})
	}
}

func (a *DesktopAppState) Disconnected(provider rpc.Transporter) {
	a.Lock()
	defer a.Unlock()
	theProvider := provider == a.provider
	a.G().Log.Debug("DesktopAppState.Disconnected(%v)", theProvider)
	if theProvider {
		a.provider = nil
		// The connection to electron has been severed. We won't get any more power
		// status updates from it. So act as though the machine is on in the default state.
		a.resetLocked()
	}
}

func (a *DesktopAppState) AwakeAndUnlocked(mctx MetaContext) bool {
	a.Lock()
	defer a.Unlock()
	if a.suspended || a.locked {
		return false
	}
	// A recent wake with no power event is either a dark wake or a machine
	// with nothing reporting power state; don't claim awake until it has
	// stayed up for a while.
	if !a.wokeAt.IsZero() && time.Since(a.wokeAt) < wakeQuarantine {
		mctx.Debug("DesktopAppState: in post-wake quarantine, woke %v ago", time.Since(a.wokeAt))
		return false
	}
	return true
}

func (a *DesktopAppState) resetLocked() {
	prevSuspended := a.suspended
	a.suspended = false
	a.locked = false
	if prevSuspended {
		close(a.suspendChanged)
		a.suspendChanged = make(chan struct{})
	}
}
