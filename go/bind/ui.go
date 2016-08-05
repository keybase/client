// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/service"
	"golang.org/x/net/context"
)

type ui struct {
	ctx *libkb.GlobalContext
}

func newUI(kbCtx *libkb.GlobalContext) *ui {
	return &ui{ctx: kbCtx}
}

func (u ui) NewRemoteIdentifyUI(sessionID int, g *libkb.GlobalContext) *service.RemoteIdentifyUI {
	// TODO: Implement identify UI for React-Native client
	return service.NewRemoteIdentifyUI(g, sessionID, autoIdentifyUI{sessionID: sessionID}, u.GetLogUI(sessionID))
}

func (u ui) GetLogUI(sessionID int) libkb.LogUI {
	if u.ctx.UI == nil {
		u.ctx.Log.Error("No UI")
		return nil
	}
	return u.ctx.UI.GetLogUI()
}

// Only used for debugging until we implement identify in React-Native
type autoIdentifyUI struct {
	sessionID int
}

func (i autoIdentifyUI) DisplayTLFCreateWithInvite(context.Context, keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}
func (i autoIdentifyUI) DelegateIdentifyUI(context.Context) (int, error)          { return i.sessionID, nil }
func (i autoIdentifyUI) Start(context.Context, keybase1.StartArg) error           { return nil }
func (i autoIdentifyUI) DisplayKey(context.Context, keybase1.DisplayKeyArg) error { return nil }
func (i autoIdentifyUI) ReportLastTrack(context.Context, keybase1.ReportLastTrackArg) error {
	return nil
}
func (i autoIdentifyUI) LaunchNetworkChecks(context.Context, keybase1.LaunchNetworkChecksArg) error {
	return nil
}
func (i autoIdentifyUI) DisplayTrackStatement(context.Context, keybase1.DisplayTrackStatementArg) error {
	return nil
}
func (i autoIdentifyUI) FinishWebProofCheck(context.Context, keybase1.FinishWebProofCheckArg) error {
	return nil
}
func (i autoIdentifyUI) FinishSocialProofCheck(context.Context, keybase1.FinishSocialProofCheckArg) error {
	return nil
}
func (i autoIdentifyUI) DisplayCryptocurrency(context.Context, keybase1.DisplayCryptocurrencyArg) error {
	return nil
}
func (i autoIdentifyUI) ReportTrackToken(context.Context, keybase1.ReportTrackTokenArg) error {
	return nil
}
func (i autoIdentifyUI) DisplayUserCard(context.Context, keybase1.DisplayUserCardArg) error {
	return nil
}
func (i autoIdentifyUI) Confirm(context.Context, keybase1.ConfirmArg) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{
		IdentityConfirmed: true,
		RemoteConfirmed:   false,
	}, nil
}
func (i autoIdentifyUI) Finish(context.Context, int) error                  { return nil }
func (i autoIdentifyUI) Dismiss(context.Context, keybase1.DismissArg) error { return nil }
