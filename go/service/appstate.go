// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type appStateHandler struct {
	*BaseHandler
	libkb.Contextified
}

func newAppStateHandler(xp rpc.Transporter, g *libkb.GlobalContext) *appStateHandler {
	return &appStateHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (a *appStateHandler) UpdateAppState(ctx context.Context, state keybase1.AppState) (err error) {
	a.G().Trace(fmt.Sprintf("UpdateAppState(%v)", state), func() error { return err })()

	// Update app state
	a.G().AppState.Update(state)
	return nil
}
