package main

import (
	"errors"

	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
	"github.com/keybase/go/libkb/engine"
	keybase_1 "github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdLogin struct {
	Username string
}

type LoginUIServer struct {
	ui libkb.LoginUI
}

func NewLoginUIProtocol() rpc2.Protocol {
	return keybase_1.LoginUiProtocol(&LoginUIServer{G_UI.GetLoginUI()})
}

func (u *LoginUIServer) GetEmailOrUsername() (string, error) {
	return u.ui.GetEmailOrUsername()
}

func (v *CmdLogin) RunClient() (err error) {
	var cli keybase_1.LoginClient
	protocols := []rpc2.Protocol{
		NewLoginUIProtocol(),
		NewIdentifySelfUIProtocol(),
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
		NewDoctorUIProtocol(),
	}
	if cli, err = GetLoginClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {
	} else {
		arg := keybase_1.PassphraseLoginArg{Identify: true, Username: v.Username}
		err = cli.PassphraseLogin(arg)
	}
	return
}

func (v *CmdLogin) Run() error {
	li := engine.NewLoginEngine()
	return li.LoginAndIdentify(engine.LoginAndIdentifyArg{
		Login: libkb.LoginArg{
			Prompt:   true,
			Retry:    3,
			Username: v.Username,
			SecretUI: G_UI.GetSecretUI(),
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

func (c *CmdLogin) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if nargs > 1 {
		err = errors.New("login takes 0 or 1 argument: [<username>]")
	} else if nargs == 1 {
		c.Username = ctx.Args()[0]
	}
	return err
}

func (v *CmdLogin) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   true,
	}
}
