package libkb

import (
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
func (a *AppState) NextUpdate() chan keybase1.AppState {
	a.Lock()
	defer a.Unlock()
	ch := make(chan keybase1.AppState, 1)
	a.updateChs = append(a.updateChs, ch)
	return ch
}

// Update updates the current app state, and notifies any waiting calls from NextUpdate
func (a *AppState) Update(state keybase1.AppState) {
	a.Lock()
	defer a.Unlock()
	a.state = state
	for _, ch := range a.updateChs {
		ch <- state
	}
	a.updateChs = nil
}

// State returns the current app state
func (a *AppState) State() keybase1.AppState {
	a.Lock()
	defer a.Unlock()
	return a.state
}
