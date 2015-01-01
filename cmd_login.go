package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libcmdline"
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
)

type CmdLogin struct{}

type LoginUIServer struct {
	eng libkb.LoginUI
}

type IdentifyUIServer struct {
	eng libkb.IdentifyUI
}

func NewLoginUIServer() *LoginUIServer {
	return &LoginUIServer{G_UI.GetLoginUI()}
}

func NewIdentifyUIServer() *IdentifyUIServer {
	return &IdentifyUIServer{G_UI.GetIdentifySelfUI(nil)}
}

func (u *LoginUIServer) GetEmailOrUsername() (string, error) {
	return u.eng.GetEmailOrUsername()
}

func (u *LoginUIServer) GetKeybasePassphrase(prompt string) (string, error) {
	return u.eng.GetKeybasePassphrase(prompt)
}

func (i *IdentifyUIServer) FinishAndPrompt(arg keybase_1.FinishAndPromptArg) (res keybase_1.FinishAndPromptRes, err error) {
	return
}

func (i *IdentifyUIServer) FinishWebProofCheck(arg keybase_1.FinishWebProofCheckArg) error {
	return nil
}

func (i *IdentifyUIServer) FinishSocialProofCheck(arg keybase_1.FinishSocialProofCheckArg) error {
	return nil
}

func (i *IdentifyUIServer) DisplayCryptocurrency(arg keybase_1.DisplayCryptocurrencyArg) error {
	return nil
}

func (i *IdentifyUIServer) DisplayKey(arg keybase_1.DisplayKeyArg) error {
	return nil
}

func (i *IdentifyUIServer) ReportLastTrack(arg keybase_1.ReportLastTrackArg) error {
	return nil
}

func (i *IdentifyUIServer) LaunchNetworkChecks(arg keybase_1.LaunchNetworkChecksArg) error {
	return nil
}

func (v *CmdLogin) RunClient() (err error) {
	var cli keybase_1.LoginClient
	if cli, err = GetLoginClient(); err != nil {
	} else if err = RegisterLoginUiServer(NewLoginUIServer()); err != nil {
	} else if err = RegisterIdentifyUiServer(NewIdentifyUIServer()); err != nil {
	} else {
		err = cli.PassphraseLogin()
	}
	return
}

func (v *CmdLogin) Run() error {
	return libkb.LoginAndIdentify(nil, nil)
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
