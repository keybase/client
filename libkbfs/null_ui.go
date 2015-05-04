package libkbfs

import (
	"github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func newLogUIProtocol() rpc2.Protocol {
	return keybase1.LogUiProtocol(&nullUI{})
}

func newIdentifyUIProtocol() rpc2.Protocol {
	return keybase1.IdentifyUiProtocol(&nullUI{})
}

type nullUI struct{}

func (n *nullUI) Start(arg keybase1.StartArg) error {
	return nil
}

func (n *nullUI) Finish(int) error {
	return nil
}

func (n *nullUI) Log(arg keybase1.LogArg) error {
	return nil
}

func (n *nullUI) FinishAndPrompt(arg keybase1.FinishAndPromptArg) (keybase1.FinishAndPromptRes, error) {
	return keybase1.FinishAndPromptRes{}, nil
}

func (n *nullUI) FinishWebProofCheck(arg keybase1.FinishWebProofCheckArg) error {
	return nil
}

func (n *nullUI) FinishSocialProofCheck(arg keybase1.FinishSocialProofCheckArg) error {
	return nil
}

func (n *nullUI) DisplayCryptocurrency(arg keybase1.DisplayCryptocurrencyArg) error {
	return nil
}

func (n *nullUI) DisplayKey(arg keybase1.DisplayKeyArg) error {
	return nil
}

func (n *nullUI) ReportLastTrack(arg keybase1.ReportLastTrackArg) error {
	return nil
}

func (n *nullUI) LaunchNetworkChecks(arg keybase1.LaunchNetworkChecksArg) error {
	return nil
}

func (n *nullUI) DisplayTrackStatement(arg keybase1.DisplayTrackStatementArg) error {
	return nil
}
