package libkbfs

import (
	"github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func newLogUIProtocol() rpc2.Protocol {
	return keybase_1.LogUiProtocol(&nullUI{})
}

func newIdentifyUIProtocol() rpc2.Protocol {
	return keybase_1.IdentifyUiProtocol(&nullUI{})
}

type nullUI struct{}

func (n *nullUI) Start(arg keybase_1.StartArg) error {
	return nil
}

func (n *nullUI) Log(arg keybase_1.LogArg) error {
	return nil
}

func (n *nullUI) FinishAndPrompt(arg keybase_1.FinishAndPromptArg) (keybase_1.FinishAndPromptRes, error) {
	return keybase_1.FinishAndPromptRes{}, nil
}

func (n *nullUI) FinishWebProofCheck(arg keybase_1.FinishWebProofCheckArg) error {
	return nil
}

func (n *nullUI) FinishSocialProofCheck(arg keybase_1.FinishSocialProofCheckArg) error {
	return nil
}

func (n *nullUI) DisplayCryptocurrency(arg keybase_1.DisplayCryptocurrencyArg) error {
	return nil
}

func (n *nullUI) DisplayKey(arg keybase_1.DisplayKeyArg) error {
	return nil
}

func (n *nullUI) ReportLastTrack(arg keybase_1.ReportLastTrackArg) error {
	return nil
}

func (n *nullUI) LaunchNetworkChecks(arg keybase_1.LaunchNetworkChecksArg) error {
	return nil
}

func (n *nullUI) DisplayTrackStatement(arg keybase_1.DisplayTrackStatementArg) error {
	return nil
}
