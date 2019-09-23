// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func newCmdBotTokenCreate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := cli.Command{
		Name:  "create",
		Usage: "Create a new bot token to sign up bots",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdBotTokenCreateRunner(g), "create", c)
		},
		Flags: []cli.Flag{},
	}
	return cmd
}

type CmdBotTokenCreate struct {
	libkb.Contextified
}

func NewCmdBotTokenCreateRunner(g *libkb.GlobalContext) *CmdBotTokenCreate {
	return &CmdBotTokenCreate{
		Contextified: libkb.NewContextified(g),
	}
}

func (t *CmdBotTokenCreate) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if nargs != 0 {
		return BadArgsError{"bot token create takes no arguments"}
	}
	return nil
}

func (t *CmdBotTokenCreate) Run() (err error) {

	bcli, err := GetBotClient(t.G())
	if err != nil {
		return err
	}
	res, err := bcli.BotTokenCreate(context.TODO())
	if err != nil {
		return err
	}
	_ = t.G().UI.GetTerminalUI().Output(res.String() + "\n")
	return nil
}

func (t *CmdBotTokenCreate) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
