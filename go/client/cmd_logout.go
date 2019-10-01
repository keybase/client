// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdLogout struct {
	libkb.Contextified
	Force bool
}

func NewCmdLogoutRunner(g *libkb.GlobalContext) *CmdLogout {
	return &CmdLogout{Contextified: libkb.NewContextified(g)}
}

func (v *CmdLogout) Run() error {
	cli, err := GetLoginClient(v.G())
	if err != nil {
		return err
	}
	ctx := context.TODO()
	return cli.Logout(ctx, keybase1.LogoutArg{Force: v.Force})
}

func NewCmdLogout(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "logout",
		Usage: "Logout and remove session information",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdLogoutRunner(g), "logout", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "If there are any reasons not to logout right now, ignore them (potentially dangerous)",
			},
		},
	}
}

func (v *CmdLogout) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (v *CmdLogout) ParseArgv(ctx *cli.Context) error {
	v.Force = ctx.Bool("force")
	return nil
}
