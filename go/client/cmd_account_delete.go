// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdAccountDelete struct {
	libkb.Contextified
}

func NewCmdAccountDelete(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "acctdelete",
		Usage: "Delete account",
		Action: func(c *cli.Context) {
			cmd := &CmdAccountDelete{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "acctdelete", c)
		},
	}
}

func (c *CmdAccountDelete) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("acctdelete takes no arguments")
	}
	return nil
}

func (c *CmdAccountDelete) Run() error {
	cli, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}
	return cli.AccountDelete(context.Background(), 0)
}

func (c *CmdAccountDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
