// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func newCmdBotTokenDelete(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := cli.Command{
		Name:  "delete",
		Usage: "Delete a bot token",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdBotTokenDeleteRunner(g), "delete", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "t, token",
				Usage: "Specify a bot token",
			},
		},
	}
	return cmd
}

type CmdBotTokenDelete struct {
	libkb.Contextified
	token keybase1.BotToken
}

func NewCmdBotTokenDeleteRunner(g *libkb.GlobalContext) *CmdBotTokenDelete {
	return &CmdBotTokenDelete{
		Contextified: libkb.NewContextified(g),
	}
}

func (t *CmdBotTokenDelete) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if nargs != 0 {
		return BadArgsError{"bot token delete takes no arguments"}
	}
	t.token, err = keybase1.NewBotToken(ctx.String("token"))
	if err != nil {
		return BadArgsError{"bad bot token"}
	}
	return nil
}

func (t *CmdBotTokenDelete) Run() (err error) {

	bcli, err := GetBotClient(t.G())
	if err != nil {
		return err
	}
	err = bcli.BotTokenDelete(context.TODO(), t.token)
	if err != nil {
		return err
	}
	return nil
}

func (t *CmdBotTokenDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
