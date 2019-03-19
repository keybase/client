package libkb

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
)

// MobileAppState tracks the state of foreground/background status of the app in which the service
// is running in.
type MobileAppState struct {
	Contextified
	sync.Mutex
	state     keybase1.MobileAppState
	updateChs []chan keybase1.MobileAppState
}

func NewMobileAppState(g *GlobalContext) *MobileAppState {
	return &MobileAppState{
		Contextified: NewContextified(g),
		state:        keybase1.MobileAppState_FOREGROUND,
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

// Update updates the current app state, and notifies any waiting calls from NextUpdate
func (a *MobileAppState) Update(state keybase1.MobileAppState) {
	a.Lock()
	defer a.Unlock()
	defer a.G().Trace(fmt.Sprintf("MobileAppState.Update(%v)", state), func() error { return nil })()
	if a.state != state {
		a.G().Log.Debug("MobileAppState.Update: useful update: %v, we are currently in state: %v",
			state, a.state)
		a.state = state
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

// State returns the current app state
func (a *MobileAppState) State() keybase1.MobileAppState {
	a.Lock()
	defer a.Unlock()
	return a.state
}

// --------------------------------------------------

type DesktopAppState struct {
	sync.Mutex
	suspended bool
	locked    bool
}

func NewDesktopAppState(g *GlobalContext) *DesktopAppState {
	return &DesktopAppState{}
}

// event from power monitor
// https://electronjs.org/docs/api/power-monitor
func (a *DesktopAppState) Update(mctx MetaContext, event string) {
	mctx.Debug("DesktopAppState.Update(%v)", event)
	a.Lock()
	defer a.Unlock()
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
}

func (a *DesktopAppState) AwakeAndUnlocked(mctx MetaContext) bool {
	a.Lock()
	defer a.Unlock()
	return !a.suspended && !a.locked
}
