// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CmdScript struct {
	libkb.Contextified
	Script string
	Args   []string
}

func newCmdScript(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "script",
		ArgumentHelp: "<script> [<args>]",
		Usage:        "Run a dev debug script",
		Action: func(c *cli.Context) {
			cmd := NewCmdScriptRunner(g)
			cl.ChooseCommand(cmd, "script", c)
		},
		Flags: []cli.Flag{},
	}
}

func NewCmdScriptRunner(g *libkb.GlobalContext) *CmdScript {
	return &CmdScript{Contextified: libkb.NewContextified(g)}
}

func (c *CmdScript) ParseArgv(ctx *cli.Context) error {
	args := ctx.Args()
	if len(args) < 1 {
		return fmt.Errorf("script name required")
	}
	c.Script = args[0]
	c.Args = args[1:]
	return nil
}

func (c *CmdScript) Run() error {
	cli, err := GetDebuggingClient(c.G())
	if err != nil {
		return err
	}
	res, err := cli.Script(context.Background(), keybase1.ScriptArg{
		Script: c.Script,
		Args:   c.Args,
	})
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("%v", res)
	return err
}

func (c *CmdScript) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
