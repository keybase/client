// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type IdentifyUIServer struct {
	ui libkb.IdentifyUI
}

func NewIdentifyUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	return keybase1.IdentifyUiProtocol(&IdentifyUIServer{g.UI.GetIdentifyUI()})
}

func NewIdentifyTrackUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	ui := g.UI.GetIdentifyTrackUI()
	return keybase1.IdentifyUiProtocol(&IdentifyUIServer{ui})
}

func (i *IdentifyUIServer) DelegateIdentifyUI(_ context.Context) (int, error) {
	return 0, libkb.UIDelegationUnavailableError{}
}

func (i *IdentifyUIServer) Confirm(_ context.Context, arg keybase1.ConfirmArg) (keybase1.ConfirmResult, error) {
	return i.ui.Confirm(&arg.Outcome)
}

func (i *IdentifyUIServer) FinishWebProofCheck(_ context.Context, arg keybase1.FinishWebProofCheckArg) error {
	i.ui.FinishWebProofCheck(arg.Rp, arg.Lcr)
	return nil
}

func (i *IdentifyUIServer) FinishSocialProofCheck(_ context.Context, arg keybase1.FinishSocialProofCheckArg) error {
	i.ui.FinishSocialProofCheck(arg.Rp, arg.Lcr)
	return nil
}

func (i *IdentifyUIServer) DisplayCryptocurrency(_ context.Context, arg keybase1.DisplayCryptocurrencyArg) error {
	i.ui.DisplayCryptocurrency(arg.C)
	return nil
}

func (i *IdentifyUIServer) DisplayStellarAccount(_ context.Context, arg keybase1.DisplayStellarAccountArg) error {
	i.ui.DisplayStellarAccount(arg.A)
	return nil
}

func (i *IdentifyUIServer) DisplayKey(_ context.Context, arg keybase1.DisplayKeyArg) error {
	i.ui.DisplayKey(arg.Key)
	return nil
}

func (i *IdentifyUIServer) ReportLastTrack(_ context.Context, arg keybase1.ReportLastTrackArg) error {
	i.ui.ReportLastTrack(arg.Track)
	return nil
}

func (i *IdentifyUIServer) LaunchNetworkChecks(_ context.Context, arg keybase1.LaunchNetworkChecksArg) error {
	return nil
}

func (i *IdentifyUIServer) DisplayTrackStatement(_ context.Context, arg keybase1.DisplayTrackStatementArg) error {
	i.ui.DisplayTrackStatement(arg.Stmt)
	return nil
}

func (i *IdentifyUIServer) ReportTrackToken(_ context.Context, arg keybase1.ReportTrackTokenArg) error {
	i.ui.ReportTrackToken(arg.TrackToken)
	return nil
}

func (i *IdentifyUIServer) DisplayUserCard(_ context.Context, arg keybase1.DisplayUserCardArg) error {
	i.ui.DisplayUserCard(arg.Card)
	return nil
}

func (i *IdentifyUIServer) Start(_ context.Context, arg keybase1.StartArg) error {
	i.ui.Start(arg.Username, arg.Reason, arg.ForceDisplay)
	return nil
}

func (i *IdentifyUIServer) Cancel(_ context.Context, sessionID int) error {
	i.ui.Cancel()
	return nil
}

func (i *IdentifyUIServer) Finish(_ context.Context, sessionID int) error {
	i.ui.Finish()
	return nil
}

func (i *IdentifyUIServer) Dismiss(_ context.Context, arg keybase1.DismissArg) error {
	i.ui.Dismiss(arg.Username, arg.Reason)
	return nil
}

func (i *IdentifyUIServer) DisplayTLFCreateWithInvite(_ context.Context, arg keybase1.DisplayTLFCreateWithInviteArg) error {
	return i.ui.DisplayTLFCreateWithInvite(arg)
}

func NewNullIdentifyUIProtocol() rpc.Protocol {
	return keybase1.IdentifyUiProtocol(&nullIdentifyUI{})
}

type nullIdentifyUI struct{}

func (c nullIdentifyUI) Start(context.Context, keybase1.StartArg) error {
	return nil
}
func (c nullIdentifyUI) FinishWebProofCheck(context.Context, keybase1.FinishWebProofCheckArg) error {
	return nil
}
func (c nullIdentifyUI) FinishSocialProofCheck(context.Context, keybase1.FinishSocialProofCheckArg) error {
	return nil
}
func (c nullIdentifyUI) Confirm(context.Context, keybase1.ConfirmArg) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{}, nil
}
func (c nullIdentifyUI) DisplayCryptocurrency(context.Context, keybase1.DisplayCryptocurrencyArg) error {
	return nil
}
func (c nullIdentifyUI) DisplayStellarAccount(context.Context, keybase1.DisplayStellarAccountArg) error {
	return nil
}
func (c nullIdentifyUI) DisplayKey(context.Context, keybase1.DisplayKeyArg) error { return nil }
func (c nullIdentifyUI) ReportLastTrack(context.Context, keybase1.ReportLastTrackArg) error {
	return nil
}
func (c nullIdentifyUI) LaunchNetworkChecks(context.Context, keybase1.LaunchNetworkChecksArg) error {
	return nil
}
func (c nullIdentifyUI) DisplayTrackStatement(context.Context, keybase1.DisplayTrackStatementArg) error {
	return nil
}
func (c nullIdentifyUI) DisplayUserCard(context.Context, keybase1.DisplayUserCardArg) error {
	return nil
}
func (c nullIdentifyUI) ReportTrackToken(context.Context, keybase1.ReportTrackTokenArg) error {
	return nil
}
func (c nullIdentifyUI) Cancel(context.Context, int) error { return nil }
func (c nullIdentifyUI) Finish(context.Context, int) error { return nil }
func (c nullIdentifyUI) DisplayTLFCreateWithInvite(context.Context, keybase1.DisplayTLFCreateWithInviteArg) error {
	return nil
}
func (c nullIdentifyUI) Dismiss(context.Context, keybase1.DismissArg) error { return nil }
func (c nullIdentifyUI) DelegateIdentifyUI(context.Context) (int, error)    { return 0, nil }
