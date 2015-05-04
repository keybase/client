package client

import (
	"errors"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdLogin struct {
	Username string
}

func NewLoginUIProtocol() rpc2.Protocol {
	return keybase1.LoginUiProtocol(G_UI.GetLoginUI())
}

func NewLocksmithUIProtocol() rpc2.Protocol {
	return keybase1.LocksmithUiProtocol(G_UI.GetLocksmithUI())
}

func (v *CmdLogin) RunClient() (err error) {
	var cli keybase1.LoginClient
	protocols := []rpc2.Protocol{
		NewLoginUIProtocol(),
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
		NewLocksmithUIProtocol(),
	}
	if cli, err = GetLoginClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {
	} else {
		err = cli.LoginWithPrompt(keybase1.LoginWithPromptArg{
			Username: v.Username,
		})
	}
	return
}

func (v *CmdLogin) Run() error {
	ctx := &engine.Context{
		LogUI:         G.UI.GetLogUI(),
		LoginUI:       G.UI.GetLoginUI(),
		LocksmithUI:   G.UI.GetLocksmithUI(),
		GPGUI:         G.UI.GetGPGUI(),
		SecretUI:      G.UI.GetSecretUI(),
		GlobalContext: G,
	}
	li := engine.NewLoginWithPromptEngine(v.Username)
	return engine.RunEngine(li, ctx)
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
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
