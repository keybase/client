// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdAccountReset struct {
	libkb.Contextified
}

func NewCmdAccountReset(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "acctreset",
		Usage: "Reset account",
		Action: func(c *cli.Context) {
			cmd := &CmdAccountReset{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "acctreset", c)
		},
	}
}

func NewCmdAccountResetRunner(g *libkb.GlobalContext) *CmdAccountReset {
	return &CmdAccountReset{Contextified: libkb.NewContextified(g)}
}

func (c *CmdAccountReset) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("acctdelete takes no arguments")
	}
	return nil
}

func (c *CmdAccountReset) Run() error {
	cli, err := GetAccountClient(c.G())
	if err != nil {
		return err
	}
	return cli.ResetAccount(context.Background(), 0)
}

func (c *CmdAccountReset) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
