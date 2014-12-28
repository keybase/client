package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libcmdline"
	"github.com/keybase/go-libkb"
)

type CmdLogin struct{

}

func (v *CmdLogin) RunClient() (err error) { 

	return nil
}

func (v *CmdLogin) Run() error {
	larg := libkb.LoginArg{Prompt: true, Retry: 3}
	if err := G.LoginState.Login(larg); err != nil {
		return err
	}

	// We might need to ID ourselves, to load us in here
	luarg := libkb.LoadUserArg{}
	u, err := libkb.LoadMe(luarg)
	if _, not_found := err.(libkb.NoKeyError); not_found {
		err = nil
	} else if _, not_selected := err.(libkb.NoSelectedKeyError); not_selected {
		_, err = u.IdentifySelf(nil)
	}
	return err
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
