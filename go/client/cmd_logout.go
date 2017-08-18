// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type CmdLogout struct {
	libkb.Contextified
}

func NewCmdLogoutRunner(g *libkb.GlobalContext) *CmdLogout {
	return &CmdLogout{Contextified: libkb.NewContextified(g)}
}

func (v *CmdLogout) Run() error {
	cli, err := GetLoginClient(v.G())
	if err != nil {
		return err
	}
	return cli.Logout(context.TODO(), 0)
}

func NewCmdLogout(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "logout",
		Usage: "Logout and remove session information",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdLogoutRunner(g), "logout", c)
		},
	}
}

func (v *CmdLogout) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (v *CmdLogout) ParseArgv(*cli.Context) error { return nil }
