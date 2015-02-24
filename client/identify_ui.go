package main

import (
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type IdentifyUIServer struct {
	eng libkb.IdentifyUI
}

func NewIdentifyUIProtocol(username string) rpc2.Protocol {
	return keybase_1.IdentifyUiProtocol(&IdentifyUIServer{G_UI.GetIdentifyUI(username)})
}

func NewIdentifyTrackUIProtocol(username string) rpc2.Protocol {
	ui := G_UI.GetIdentifyTrackUI(username, true)
	return keybase_1.IdentifyUiProtocol(&IdentifyUIServer{ui})
}

func (i *IdentifyUIServer) FinishAndPrompt(arg keybase_1.FinishAndPromptArg) (res keybase_1.FinishAndPromptRes, err error) {
	res, err = i.eng.FinishAndPrompt(&arg.Outcome)
	return
}

func (i *IdentifyUIServer) FinishWebProofCheck(arg keybase_1.FinishWebProofCheckArg) error {
	i.eng.FinishWebProofCheck(arg.Rp, arg.Lcr)
	return nil
}

func (i *IdentifyUIServer) FinishSocialProofCheck(arg keybase_1.FinishSocialProofCheckArg) error {
	i.eng.FinishSocialProofCheck(arg.Rp, arg.Lcr)
	return nil
}

func (i *IdentifyUIServer) DisplayCryptocurrency(arg keybase_1.DisplayCryptocurrencyArg) error {
	i.eng.DisplayCryptocurrency(arg.C)
	return nil
}

func (i *IdentifyUIServer) DisplayKey(arg keybase_1.DisplayKeyArg) error {
	i.eng.DisplayKey(arg.Fokid, arg.Diff)
	return nil
}

func (i *IdentifyUIServer) ReportLastTrack(arg keybase_1.ReportLastTrackArg) error {
	i.eng.ReportLastTrack(arg.Track)
	return nil
}

func (i *IdentifyUIServer) LaunchNetworkChecks(arg keybase_1.LaunchNetworkChecksArg) error {
	return nil
}

func (i *IdentifyUIServer) DisplayTrackStatement(arg keybase_1.DisplayTrackStatementArg) error {
	i.eng.DisplayTrackStatement(arg.Stmt)
	return nil
}
