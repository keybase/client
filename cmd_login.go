package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libcmdline"
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
)

type CmdLogin struct {}

type LoginUIServer struct {
	eng libkb.LoginUI
}

func NewLoginUIServer() *LoginUIServer {
	return &LoginUIServer { G_UI.GetLoginUI() }
}

func (u *LoginUIServer) GetEmailOrUsername(arg *keybase_1.GetEmailOrUsernameArg, res *keybase_1.GetEmailOrUsernameRes) error {
	*res = u.eng.GetEmailOrUsername()	
	return nil
}

func (u *LoginUIServer) GetKeybasePassphrase(prompt *string, res *keybase_1.GetKeybasePassphraseRes) error {
	*res = u.eng.GetKeybasePassphrase(*prompt)
	return nil
}

func (v *CmdLogin) RunClient() (err error) {
	var cli keybase_1.LoginClient
	var status keybase_1.Status
	if cli, err = GetLoginClient(); err != nil {
	} else {
		if err = RegisterLoginUiServer(NewLoginUIServer()); err != nil {
		} else {
			if err = cli.PassphraseLogin(keybase_1.PassphraseLoginArg{}, &status); err != nil {
			} else {
				err = libkb.ImportStatusAsError(status)
			}
		}
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
