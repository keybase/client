package libkb

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// MobileAppState tracks the state of foreground/background status of the app
// in which the service is running in.
type MobileAppState struct {
	Contextified
	sync.Mutex
	state     keybase1.MobileAppState
	updateChs []chan keybase1.MobileAppState

	// mtime is the time at which the appstate first switched to the current state.
	// It is a monotonic timestamp and should only be used relatively.
	mtime *time.Time
}

func NewMobileAppState(g *GlobalContext) *MobileAppState {
	return &MobileAppState{
		Contextified: NewContextified(g),
		state:        keybase1.MobileAppState_FOREGROUND,
		mtime:        nil,
	}
}

// NextUpdate returns a channel that triggers when the app state changes
func (a *MobileAppState) NextUpdate(lastState *keybase1.MobileAppState) chan keybase1.MobileAppState {
	a.Lock()
	defer a.Unlock()
	ch := make(chan keybase1.MobileAppState, 1)
	if lastState != nil && *lastState != a.state {
		ch <- a.state
	} else {
		a.updateChs = append(a.updateChs, ch)
	}
	return ch
}

func (a *MobileAppState) updateLocked(state keybase1.MobileAppState) {
	if a.state != state {
		a.G().Log.Debug("MobileAppState.Update: useful update: %v, we are currently in state: %v",
			state, a.state)
		a.state = state
		t := time.Now()
		a.mtime = &t // only update mtime if we're changing state
		for _, ch := range a.updateChs {
			ch <- state
		}
		a.updateChs = nil

		// cancel RPCs if we go into the background
		switch a.state {
		case keybase1.MobileAppState_BACKGROUND:
			a.G().RPCCanceler.CancelLiveContexts(RPCCancelerReasonBackground)
		}
	} else {
		a.G().Log.Debug("MobileAppState.Update: ignoring update: %v, we are currently in state: %v",
			state, a.state)
	}
}

func (a *MobileAppState) UpdateWithCheck(state keybase1.MobileAppState,
	check func(keybase1.MobileAppState) bool) {
	defer a.G().Trace(fmt.Sprintf("MobileAppState.UpdateWithCheck(%v)", state), func() error { return nil })()
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
	defer a.G().Trace(fmt.Sprintf("MobileAppState.Update(%v)", state), func() error { return nil })()
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
	state     keybase1.MobileNetworkState
	updateChs []chan keybase1.MobileNetworkState
}

func NewMobileNetState(g *GlobalContext) *MobileNetState {
	return &MobileNetState{
		Contextified: NewContextified(g),
		state:        keybase1.MobileNetworkState_NOTAVAILABLE,
	}
}

// NextUpdate returns a channel that triggers when the network state changes
func (a *MobileNetState) NextUpdate(lastState *keybase1.MobileNetworkState) chan keybase1.MobileNetworkState {
	a.Lock()
	defer a.Unlock()
	ch := make(chan keybase1.MobileNetworkState, 1)
	if lastState != nil && *lastState != a.state {
		ch <- a.state
	} else {
		a.updateChs = append(a.updateChs, ch)
	}
	return ch
}

// Update updates the current network state, and notifies any waiting calls
// from NextUpdate
func (a *MobileNetState) Update(state keybase1.MobileNetworkState) {
	defer a.G().Trace(fmt.Sprintf("MobileNetState.Update(%v)", state), func() error { return nil })()
	a.Lock()
	defer a.Unlock()
	if a.state != state {
		a.G().Log.Debug("MobileNetState.Update: useful update: %v, we are currently in state: %v",
			state, a.state)
		a.state = state
		for _, ch := range a.updateChs {
			ch <- state
		}
		a.updateChs = nil
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

type DesktopAppState struct {
	Contextified
	sync.Mutex
	provider         rpc.Transporter
	suspended        bool
	locked           bool
	updateSuspendChs []chan bool
}

func NewDesktopAppState(g *GlobalContext) *DesktopAppState {
	return &DesktopAppState{Contextified: NewContextified(g)}
}

func (a *DesktopAppState) NextSuspendUpdate(lastState *bool) chan bool {
	a.Lock()
	defer a.Unlock()
	ch := make(chan bool, 1)
	if lastState != nil && *lastState != a.suspended {
		ch <- a.suspended
	} else {
		a.updateSuspendChs = append(a.updateSuspendChs, ch)
	}
	return ch
}

// event from power monitor
// https://electronjs.org/docs/api/power-monitor
func (a *DesktopAppState) Update(mctx MetaContext, event string, provider rpc.Transporter) {
	mctx.Debug("DesktopAppState.Update(%v)", event)
	a.Lock()
	defer a.Unlock()
	a.provider = provider
	switch event {
	case "suspend":
		a.suspended = true
	case "resume":
		a.suspended = false
	case "shutdown":
	case "lock-screen":
		a.locked = true
	case "unlock-screen":
		a.suspended = false
		a.locked = false
	}
	for _, ch := range a.updateSuspendChs {
		ch <- a.suspended
	}
	a.updateSuspendChs = nil
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
		a.suspended = false
		a.locked = false
	}
}

func (a *DesktopAppState) AwakeAndUnlocked(mctx MetaContext) bool {
	a.Lock()
	defer a.Unlock()
	return !a.suspended && !a.locked
}
