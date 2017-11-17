// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type CmdBadge struct {
	libkb.Contextified
}

func (c *CmdBadge) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdBadge) Run() error {
	cli, err := GetBadgerClient(c.G())
	if err != nil {
		return err
	}
	ctx := context.Background()
	state, err := cli.GetBadgeState(ctx)
	if err != nil {
		return err
	}
	b, err := json.Marshal(state)
	if err != nil {
		return err
	}
	return c.G().UI.GetTerminalUI().OutputDesc(OutputDescriptorBadgeDump, string(b)+"\n")
}

func NewCmdBadgeRunner(g *libkb.GlobalContext) *CmdBadge {
	return &CmdBadge{Contextified: libkb.NewContextified(g)}
}

func NewCmdBadge(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "badge",
		Usage: "Get the client's badge state",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdBadgeRunner(g), "badge", c)
		},
		Flags: []cli.Flag{},
	}
}

func (c *CmdBadge) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
