// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
)

type CmdDismissCategory struct {
	libkb.Contextified
	category string
}

func (c *CmdDismissCategory) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Must provide exactly one category.")
	}
	c.category = ctx.Args()[0]
	return nil
}

func (c *CmdDismissCategory) Run() error {
	cli, err := GetGregorClient(c.G())
	if err != nil {
		return err
	}

	return cli.DismissCategory(context.TODO(), gregor1.Category(c.category))
}

func NewCmdDismissCategoryRunner(g *libkb.GlobalContext) *CmdDismissCategory {
	return &CmdDismissCategory{Contextified: libkb.NewContextified(g)}
}

func NewCmdDismissCategory(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	ret := cli.Command{
		Name:         "dismiss-category",
		ArgumentHelp: "<category>",
		Description:  "Dismiss an entire category of notifications",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdDismissCategoryRunner(g), "dismiss-category", c)
		},
	}
	return ret
}

func (c *CmdDismissCategory) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
