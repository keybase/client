// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// compatibility with node client commands:

func NewCmdCompatDir(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	desc := "`keybase dir` has been deprecated. Use `keybase config get mountdir` to see the mount directory."
	return cli.Command{
		Name: "dir",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdCompat{Contextified: libkb.NewContextified(g), msg: desc, suggestion: "keybase config get mountdir"}, "compat", c)
		},
		Description: desc,
	}
}

func NewCmdCompatPush(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	desc := "Use `keybase pgp select` instead."
	return cli.Command{
		Name: "push",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdCompat{Contextified: libkb.NewContextified(g), msg: desc}, "compat", c)
		},
	}
}

type cmdCompat struct {
	libkb.Contextified
	msg        string
	suggestion string
}

func (c *cmdCompat) GetUsage() libkb.Usage { return libkb.Usage{} }
func (c *cmdCompat) Run() error {
	ui := c.G().UI.GetTerminalUI()
	ui.Printf("%s\n", c.msg)
	if c.suggestion != "" {
		ui.Printf("Try: %s\n", c.suggestion)
	}
	return nil
}
func (c *cmdCompat) ParseArgv(ctx *cli.Context) error {
	return nil
}
