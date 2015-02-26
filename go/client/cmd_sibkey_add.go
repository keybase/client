package main

import (
	"fmt"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdSibkeyAdd struct {
	phrase string
}

func NewCmdSibkeyAdd(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "add",
		Usage:       "keybase sibkey add \"secret phrase\"",
		Description: "Add a new device sibkey",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSibkeyAdd{}, "add", c)
		},
	}
}

func (c *CmdSibkeyAdd) RunClient() error {
	return nil
}

func (c *CmdSibkeyAdd) Run() error {
	return nil
}

func (c *CmdSibkeyAdd) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("sibkey add takes one arg: the secret phrase")
	}
	c.phrase = ctx.Args()[0]
	return nil
}

func (v *CmdSibkeyAdd) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   true,
	}
}
