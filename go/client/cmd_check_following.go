// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdCheckTracking struct {
	libkb.Contextified
}

func (c *CmdCheckTracking) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdCheckTracking) Run() (err error) {
	cli, err := GetTrackClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{}
	if err = RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	err = cli.CheckTracking(context.TODO(), 0 /* session ID */)
	if err != nil {
		return err
	}
	return nil
}

func NewCmdCheckTracking(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "check-following",
		Flags: []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdCheckTrackingRunner(g), "check-following", c)
		},
	}
}

func NewCmdCheckTrackingRunner(g *libkb.GlobalContext) *CmdCheckTracking {
	return &CmdCheckTracking{Contextified: libkb.NewContextified(g)}
}

func (c *CmdCheckTracking) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
