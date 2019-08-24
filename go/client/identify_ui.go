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
	libkb.Contextified
	ui libkb.IdentifyUI
}

func NewIdentifyUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	return keybase1.IdentifyUiProtocol(&IdentifyUIServer{
		Contextified: libkb.NewContextified(g),
		ui:           g.UI.GetIdentifyUI(),
	})
}

func NewIdentifyTrackUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	ui := g.UI.GetIdentifyTrackUI()
	return keybase1.IdentifyUiProtocol(&IdentifyUIServer{
		Contextified: libkb.NewContextified(g),
		ui:           ui,
	})
}

func (i *IdentifyUIServer) newMetaContext(ctx context.Context) libkb.MetaContext {
	return libkb.NewMetaContext(ctx, i.G())
}

func (i *IdentifyUIServer) DelegateIdentifyUI(_ context.Context) (int, error) {
	return 0, libkb.UIDelegationUnavailableError{}
}

func (i *IdentifyUIServer) Confirm(ctx context.Context, arg keybase1.ConfirmArg) (keybase1.ConfirmResult, error) {
	return i.ui.Confirm(i.newMetaContext(ctx), &arg.Outcome)
}

func (i *IdentifyUIServer) FinishWebProofCheck(ctx context.Context, arg keybase1.FinishWebProofCheckArg) error {
	i.ui.FinishWebProofCheck(i.newMetaContext(ctx), arg.Rp, arg.Lcr)
	return nil
}

func (i *IdentifyUIServer) FinishSocialProofCheck(ctx context.Context, arg keybase1.FinishSocialProofCheckArg) error {
	i.ui.FinishSocialProofCheck(i.newMetaContext(ctx), arg.Rp, arg.Lcr)
	return nil
}

func (i *IdentifyUIServer) DisplayCryptocurrency(ctx context.Context, arg keybase1.DisplayCryptocurrencyArg) error {
	i.ui.DisplayCryptocurrency(i.newMetaContext(ctx), arg.C)
	return nil
}

func (i *IdentifyUIServer) DisplayStellarAccount(ctx context.Context, arg keybase1.DisplayStellarAccountArg) error {
	i.ui.DisplayStellarAccount(i.newMetaContext(ctx), arg.A)
	return nil
}

func (i *IdentifyUIServer) DisplayKey(ctx context.Context, arg keybase1.DisplayKeyArg) error {
	i.ui.DisplayKey(i.newMetaContext(ctx), arg.Key)
	return nil
}

func (i *IdentifyUIServer) ReportLastTrack(ctx context.Context, arg keybase1.ReportLastTrackArg) error {
	i.ui.ReportLastTrack(i.newMetaContext(ctx), arg.Track)
	return nil
}

func (i *IdentifyUIServer) LaunchNetworkChecks(ctx context.Context, arg keybase1.LaunchNetworkChecksArg) error {
	return nil
}

func (i *IdentifyUIServer) DisplayTrackStatement(ctx context.Context, arg keybase1.DisplayTrackStatementArg) error {
	i.ui.DisplayTrackStatement(i.newMetaContext(ctx), arg.Stmt)
	return nil
}

func (i *IdentifyUIServer) ReportTrackToken(ctx context.Context, arg keybase1.ReportTrackTokenArg) error {
	i.ui.ReportTrackToken(i.newMetaContext(ctx), arg.TrackToken)
	return nil
}

func (i *IdentifyUIServer) DisplayUserCard(ctx context.Context, arg keybase1.DisplayUserCardArg) error {
	i.ui.DisplayUserCard(i.newMetaContext(ctx), arg.Card)
	return nil
}

func (i *IdentifyUIServer) Start(ctx context.Context, arg keybase1.StartArg) error {
	i.ui.Start(i.newMetaContext(ctx), arg.Username, arg.Reason, arg.ForceDisplay)
	return nil
}

func (i *IdentifyUIServer) Cancel(ctx context.Context, sessionID int) error {
	i.ui.Cancel(i.newMetaContext(ctx))
	return nil
}

func (i *IdentifyUIServer) Finish(ctx context.Context, sessionID int) error {
	i.ui.Finish(i.newMetaContext(ctx))
	return nil
}

func (i *IdentifyUIServer) Dismiss(ctx context.Context, arg keybase1.DismissArg) error {
	i.ui.Dismiss(i.newMetaContext(ctx), arg.Username, arg.Reason)
	return nil
}

func (i *IdentifyUIServer) DisplayTLFCreateWithInvite(ctx context.Context, arg keybase1.DisplayTLFCreateWithInviteArg) error {
	return i.ui.DisplayTLFCreateWithInvite(i.newMetaContext(ctx), arg)
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
