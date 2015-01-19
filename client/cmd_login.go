package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdLogin struct{}

type LoginUIServer struct {
	eng libkb.LoginUI
}

type IdentifyUIServer struct {
	eng libkb.IdentifyUI
}

func NewLoginUIProtocol() rpc2.Protocol {
	return keybase_1.LoginUiProtocol(&LoginUIServer{G_UI.GetLoginUI()})
}

func NewIdentifyUIProtocol() rpc2.Protocol {
	return keybase_1.IdentifyUiProtocol(&IdentifyUIServer{G_UI.GetIdentifyUI(nil)})
}

func NewIdentifySelfUIProtocol() rpc2.Protocol {
	return keybase_1.IdentifyUiProtocol(&IdentifyUIServer{G_UI.GetIdentifySelfUI()})
}

func (u *LoginUIServer) GetEmailOrUsername() (string, error) {
	return u.eng.GetEmailOrUsername()
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

func (v *CmdLogin) RunClient() (err error) {
	var cli keybase_1.LoginClient
	protocols := []rpc2.Protocol{
		NewLoginUIProtocol(),
		NewIdentifySelfUIProtocol(),
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
	}
	if cli, err = GetLoginClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {
	} else {
		err = cli.PassphraseLogin(keybase_1.PassphraseLoginArg{Identify: true})
	}
	return
}

func (v *CmdLogin) Run() error {
	return libkb.LoginAndIdentify(libkb.LoginAndIdentifyArg{
		Login: libkb.LoginArg{
			Prompt: true,
			Retry:  3,
		},
		IdentifyUI: G_UI.GetIdentifySelfUI(),
	})
}

func NewCmdLogin(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "login",
		Usage: "Establish a session with the keybase server " +
			"(if necessary)",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdLogin{}, "login", c)
		},
	}
}

func (c *CmdLogin) ParseArgv(*cli.Context) error { return nil }

func (v *CmdLogin) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   true,
	}
}
