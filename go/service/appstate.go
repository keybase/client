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
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (a *appStateHandler) Shutdown() {
	a.G().DesktopAppState.Disconnected(a.xp)
}

func (a *appStateHandler) UpdateAppState(ctx context.Context, state keybase1.MobileAppState) (err error) {
	a.G().Trace(fmt.Sprintf("UpdateAppState(%v)", state), func() error { return err })()

	// Update app state
	a.G().MobileAppState.Update(state)
	return nil
}

func (a *appStateHandler) UpdateMobileNetState(ctx context.Context, state keybase1.MobileNetworkState) (err error) {
	a.G().Log.CDebugf(ctx, "UpdateMobileNetState(%v)", state)
	a.G().MobileNetState.Update(state)
	return nil
}

func (a *appStateHandler) PowerMonitorEvent(ctx context.Context, event string) (err error) {
	a.G().Log.CDebugf(ctx, "PowerMonitorEvent(%v)", event)
	a.G().DesktopAppState.Update(a.MetaContext(ctx), event, a.xp)
	return nil
}
