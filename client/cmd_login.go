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

func NewLoginUIProtocol() rpc2.Protocol {
	return keybase_1.LoginUiProtocol(&LoginUIServer{G_UI.GetLoginUI()})
}

func (u *LoginUIServer) GetEmailOrUsername() (string, error) {
	return u.eng.GetEmailOrUsername()
}

func (c *CmdLogin) RunClient() (err error) {
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

func (c *CmdLogin) Run() error {
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

func (c *CmdLogin) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   true,
	}
}
