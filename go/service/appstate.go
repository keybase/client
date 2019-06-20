// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"strings"

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

func (a *appStateHandler) UpdateMobileNetState(ctx context.Context, stateStr string) (err error) {
	a.G().Log.CDebugf(ctx, "UpdateMobileNetState(%v)", stateStr)

	// normalize what the frontend gives us, `bluetooth`, `ethernet`, and
	// `wimax` are android only values.
	var state keybase1.MobileNetworkState
	switch stateStr {
	case "bluetooth", "ethernet":
		stateStr = "wifi"
	case "wimax":
		stateStr = "cellular"
	}

	state, ok := keybase1.MobileNetworkStateMap[strings.ToUpper(stateStr)]
	if !ok {
		state = keybase1.MobileNetworkState_UNKNOWN
	}
	a.G().MobileNetState.Update(state)
	return nil
}

func (a *appStateHandler) PowerMonitorEvent(ctx context.Context, event string) (err error) {
	a.G().Log.CDebugf(ctx, "PowerMonitorEvent(%v)", event)
	a.G().DesktopAppState.Update(a.MetaContext(ctx), event, a.xp)
	return nil
}
