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
	desc := "`keybase dir` has been deprecated."
	return cli.Command{
		Name: "dir",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdCompat{Contextified: libkb.NewContextified(g), msg: desc}, "compat", c)
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
	msg string
}

func (c *cmdCompat) GetUsage() libkb.Usage { return libkb.Usage{} }
func (c *cmdCompat) Run() error {
	c.G().UI.GetTerminalUI().Printf("%s\n", c.msg)
	return nil
}
func (c *cmdCompat) ParseArgv(ctx *cli.Context) error {
	return nil
}
