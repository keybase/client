package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type CmdLogin struct {
	Username  string
	sessionID int
}

func NewLoginUIProtocol() rpc.Protocol {
	return keybase1.LoginUiProtocol(GlobUI.GetLoginUI())
}

func NewLocksmithUIProtocol() rpc.Protocol {
	return keybase1.LocksmithUiProtocol(GlobUI.GetLocksmithUI())
}

func (v *CmdLogin) client() (*keybase1.LoginClient, error) {
	protocols := []rpc.Protocol{
		NewLoginUIProtocol(),
		NewSecretUIProtocol(),
		NewLocksmithUIProtocol(),
		NewGPGUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return nil, err
	}

	c, err := GetLoginClient()
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (v *CmdLogin) Run() error {
	cli, err := v.client()
	if err != nil {
		return err
	}
	v.sessionID, err = libkb.RandInt()
	if err != nil {
		return err
	}
	return cli.LoginWithPrompt(keybase1.LoginWithPromptArg{
		SessionID: v.sessionID,
		Username:  v.Username,
	})
}

func (v *CmdLogin) Cancel() error {
	if v.sessionID == 0 {
		return nil
	}
	cli, err := v.client()
	if err != nil {
		return err
	}
	return cli.CancelLogin(v.sessionID)
}

func NewCmdLogin(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "login",
		ArgumentHelp: "[username]",
		Usage:        "Establish a session with the keybase server",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdLogin{}, "login", c)
		},
	}
}

func (v *CmdLogin) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if nargs > 1 {
		err = errors.New("Invalid arguments.")
	} else if nargs == 1 {
		v.Username = ctx.Args()[0]
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
