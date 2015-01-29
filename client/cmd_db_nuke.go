package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
)

type CmdDbNuke struct {
	force bool
}

func (c *CmdDbNuke) ParseArgv(ctx *cli.Context) error {
	c.force = ctx.Bool("force")
	return nil
}

func (c *CmdDbNuke) RunClient() error { return c.Run() }

func (c *CmdDbNuke) Run() error {
	var err error
	if !c.force {
		err = G_UI.PromptForConfirmation("Really blast away your local DB cache?")
	}
	if err == nil {
		err = G.LocalDb.Nuke()
	}
	return err
}

func NewCmdDbNuke(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "nuke",
		Usage:       "keybase db nuke",
		Description: "Delete the local DB cache",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDbNuke{}, "nuke", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "force, f",
				Usage: "Force nuking; don't prompt",
			},
		},
	}
}

func NewCmdDb(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "db",
		Usage:       "keybase db [subcommands...]",
		Description: "Manipulate the local Keybase DB",
		Subcommands: []cli.Command{
			NewCmdDbNuke(cl),
			NewCmdDbCache(cl),
		},
	}
}

func (c *CmdDbNuke) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  false,
		API:        true,
		Terminal:   true,
	}
}
