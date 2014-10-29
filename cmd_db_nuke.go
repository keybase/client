package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go-libkb"
)

type CmdDbNuke struct {
	ctx *cli.Context
}

func (c *CmdDbNuke) Run() error {
	var err error
	force := c.ctx.Bool("force")
	if !force {
		err = libkb.PromptForConfirmation("Really blast away your local DB cache?")
	}
	if err == nil {
		err = G.LocalDb.Nuke()
	}
	return err
}

func NewCmdDbNuke(cl *CommandLine) cli.Command {
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

func (v *CmdDbNuke) UseConfig() bool              { return true }
func (v *CmdDbNuke) UseKeyring() bool             { return false }
func (v *CmdDbNuke) UseAPI() bool                 { return false }
func (v *CmdDbNuke) UseTerminal() bool            { return true }
func (c *CmdDbNuke) ParseArgv(*cli.Context) error { return nil }

func NewCmdDb(cl *CommandLine) cli.Command {
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
