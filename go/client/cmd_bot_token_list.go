// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func newCmdBotTokenList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := cli.Command{
		Name:  "list",
		Usage: "List bot tokens associated with this account",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdBotTokenListRunner(g), "list", c)
		},
		Flags: []cli.Flag{},
	}
	return cmd
}

type CmdBotTokenList struct {
	libkb.Contextified
}

func NewCmdBotTokenListRunner(g *libkb.GlobalContext) *CmdBotTokenList {
	return &CmdBotTokenList{
		Contextified: libkb.NewContextified(g),
	}
}

func (t *CmdBotTokenList) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if nargs != 0 {
		return BadArgsError{"bot token list takes no arguments"}
	}
	return nil
}

func (t *CmdBotTokenList) Run() (err error) {

	bcli, err := GetBotClient(t.G())
	if err != nil {
		return err
	}
	res, err := bcli.BotTokenList(context.TODO())
	if err != nil {
		return err
	}
	for _, row := range res {
		_ = t.G().UI.GetTerminalUI().Output(row.Token.String() + "\n")
	}
	return nil
}

func (t *CmdBotTokenList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
