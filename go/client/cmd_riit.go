// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type cmdRIIT struct {
	libkb.Contextified
	arg keybase1.ResolveIdentifyImplicitTeamArg
}

func NewCmdRIIT(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "riit",
		Description:  "resolve ResolveIdentifyImplicitTeam",
		ArgumentHelp: "name",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "c, create",
				Usage: "Enable if you want to create the TLF if it doesn't exist",
			},
			cli.BoolFlag{
				Name:  "public",
				Usage: "Treat the team as a public team",
			},
			cli.BoolFlag{
				Name:  "i, identify",
				Usage: "Identify the users too",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdRIIT{Contextified: libkb.NewContextified(g)}, "riit", c)
		},
	}
}

func (c *cmdRIIT) Run() error {
	var cli keybase1.IdentifyClient
	protocols := []rpc.Protocol{}

	// always register this, even if ui is delegated, so that
	// fallback to terminal UI works.
	protocols = append(protocols, NewIdentifyUIProtocol(c.G()))
	cli, err := GetIdentifyClient(c.G())
	if err != nil {
		return err
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	res, err := cli.ResolveIdentifyImplicitTeam(context.TODO(), c.arg)
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Printf("%+v\n", res)
	return nil
}

func (c *cmdRIIT) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("need a name argument")
	}
	c.arg.Assertions = ctx.Args()[0]
	if ctx.Bool("create") {
		c.arg.Create = true
	}
	if ctx.Bool("public") {
		c.arg.IsPublic = true
	}
	if ctx.Bool("identify") {
		c.arg.DoIdentifies = true
	}
	return nil
}

func (c *cmdRIIT) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
