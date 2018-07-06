package libkb

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
)

// AppState tracks the state of foreground/background status of the app in which the service
// is running in.
type AppState struct {
	Contextified
	sync.Mutex

	state     keybase1.AppState
	updateChs []chan keybase1.AppState
}

// NewAppState returns a new AppState
func NewAppState(g *GlobalContext) *AppState {
	return &AppState{
		Contextified: NewContextified(g),
		state:        keybase1.AppState_FOREGROUND,
	}
}

// NextUpdate returns a channel that triggers when the app state changes
func (a *AppState) NextUpdate(lastState *keybase1.AppState) chan keybase1.AppState {
	a.Lock()
	defer a.Unlock()
	ch := make(chan keybase1.AppState, 1)
	if lastState != nil && *lastState != a.state {
		ch <- a.state
	} else {
		a.updateChs = append(a.updateChs, ch)
	}
	return ch
}

// Update updates the current app state, and notifies any waiting calls from NextUpdate
func (a *AppState) Update(state keybase1.AppState) {
	a.Lock()
	defer a.Unlock()
	defer a.G().Trace(fmt.Sprintf("AppState.Update(%v)", state), func() error { return nil })()
	if a.state != state {
		a.G().Log.Debug("AppState.Update: useful update: %v, we are currently in state: %v",
			state, a.state)
		a.state = state
		for _, ch := range a.updateChs {
			ch <- state
		}
		// cancel RPCs if we go into the background
		switch a.state {
		case keybase1.AppState_BACKGROUND:
			a.G().RPCCanceller.CancelLiveContexts()
		}
		a.updateChs = nil
	} else {
		a.G().Log.Debug("AppState.Update: ignoring update: %v, we are currently in state: %v",
			state, a.state)
	}
}

// State returns the current app state
func (a *AppState) State() keybase1.AppState {
	a.Lock()
	defer a.Unlock()
	return a.state
}
