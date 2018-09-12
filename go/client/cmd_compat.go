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
	return cli.Command{
		Name: "dir",
		Action: func(c *cli.Context) {
			g.UI.GetTerminalUI().Printf("`keybase dir` has been deprecated.\n")
		},
		Description: "`keybase dir` has been deprecated.",
	}
}

func NewCmdCompatPush(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "push",
		Action: func(c *cli.Context) {
			g.UI.GetTerminalUI().Printf("Use `keybase pgp select` instead.\n")
		},
		Description: "Use `keybase pgp select` instead.",
	}
}
