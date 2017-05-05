// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"context"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type appState struct {
	libkb.Contextified
	sync.Mutex

	state     keybase1.AppState
	updateChs []chan keybase1.AppState
}

func newAppState(g *libkb.GlobalContext) *appState {
	return &appState{
		Contextified: libkb.NewContextified(g),
		state:        keybase1.AppState_FOREGROUND,
	}
}

func (a *appState) NextUpdate() chan keybase1.AppState {
	a.Lock()
	defer a.Unlock()
	ch := make(chan keybase1.AppState, 1)
	a.updateChs = append(a.updateChs, ch)
	return ch
}

func (a *appState) Update(state keybase1.AppState) {
	a.Lock()
	defer a.Unlock()
	a.state = state
	for _, ch := range a.updateChs {
		ch <- state
	}
	a.updateChs = nil
}

func (a *appState) State() keybase1.AppState {
	a.Lock()
	defer a.Unlock()
	return a.state
}

type appStateHandler struct {
	*BaseHandler
	libkb.Contextified

	appState *appState
}

func newAppStateHandler(xp rpc.Transporter, g *libkb.GlobalContext, appState *appState) *appStateHandler {
	return &appStateHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		appState:     appState,
	}
}

func (a *appStateHandler) UpdateAppState(ctx context.Context, state keybase1.AppState) (err error) {
	a.G().Trace("UpdateAppState", func() error { return err })()

	// Update app state
	a.appState.Update(state)
	return nil
}
