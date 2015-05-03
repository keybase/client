package client

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type IdentifyUIServer struct {
	ui libkb.IdentifyUI
}

func NewIdentifyUIProtocol() rpc2.Protocol {
	return keybase_1.IdentifyUiProtocol(&IdentifyUIServer{G_UI.GetIdentifyUI()})
}

func NewIdentifyTrackUIProtocol() rpc2.Protocol {
	ui := G_UI.GetIdentifyTrackUI(true)
	return keybase_1.IdentifyUiProtocol(&IdentifyUIServer{ui})
}

func (i *IdentifyUIServer) FinishAndPrompt(arg keybase_1.FinishAndPromptArg) (res keybase_1.FinishAndPromptRes, err error) {
	res, err = i.ui.FinishAndPrompt(&arg.Outcome)
	return
}

func (i *IdentifyUIServer) FinishWebProofCheck(arg keybase_1.FinishWebProofCheckArg) error {
	i.ui.FinishWebProofCheck(arg.Rp, arg.Lcr)
	return nil
}

func (i *IdentifyUIServer) FinishSocialProofCheck(arg keybase_1.FinishSocialProofCheckArg) error {
	i.ui.FinishSocialProofCheck(arg.Rp, arg.Lcr)
	return nil
}

func (i *IdentifyUIServer) DisplayCryptocurrency(arg keybase_1.DisplayCryptocurrencyArg) error {
	i.ui.DisplayCryptocurrency(arg.C)
	return nil
}

func (i *IdentifyUIServer) DisplayKey(arg keybase_1.DisplayKeyArg) error {
	i.ui.DisplayKey(arg.Fokid, arg.Diff)
	return nil
}

func (i *IdentifyUIServer) ReportLastTrack(arg keybase_1.ReportLastTrackArg) error {
	i.ui.ReportLastTrack(arg.Track)
	return nil
}

func (i *IdentifyUIServer) LaunchNetworkChecks(arg keybase_1.LaunchNetworkChecksArg) error {
	return nil
}

func (i *IdentifyUIServer) DisplayTrackStatement(arg keybase_1.DisplayTrackStatementArg) error {
	i.ui.DisplayTrackStatement(arg.Stmt)
	return nil
}

func (i *IdentifyUIServer) Start(arg keybase_1.StartArg) error {
	i.ui.Start(arg.Username)
	return nil
}

func (i *IdentifyUIServer) Finish(sessionID int) error {
	i.ui.Finish()
	return nil
}
