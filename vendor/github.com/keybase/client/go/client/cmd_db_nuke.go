// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type CmdDbNuke struct {
	libkb.Contextified
	force bool
}

func (c *CmdDbNuke) ParseArgv(ctx *cli.Context) error {
	c.force = ctx.Bool("force")
	return nil
}

func (c *CmdDbNuke) Run() error {
	var err error
	if !c.force {
		err = GlobUI.PromptForConfirmation("Really blast away your local database?")
	}
	if err == nil {
		cli, err := GetCtlClient(c.G())
		if err != nil {
			return err
		}
		if err = RegisterProtocols(nil); err != nil {
			return err
		}
		return cli.DbNuke(context.TODO(), 0)
	}
	return err
}

func NewCmdDbNuke(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "nuke",
		Usage: "Delete the local database",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdDbNukeRunner(g), "nuke", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "force, f",
				Usage: "Don't prompt.",
			},
		},
	}
}

func NewCmdDbNukeRunner(g *libkb.GlobalContext) *CmdDbNuke {
	return &CmdDbNuke{
		Contextified: libkb.NewContextified(g),
		force:        false,
	}
}

func NewCmdDb(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "db",
		Subcommands: []cli.Command{
			NewCmdDbNuke(cl, g),
		},
	}
}

func (c *CmdDbNuke) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
