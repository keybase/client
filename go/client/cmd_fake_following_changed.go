// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdFakeTrackingChanged struct {
	libkb.Contextified
	arg keybase1.FakeTrackingChangedArg
}

func (c *CmdFakeTrackingChanged) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Must provide exactly one username.")
	}
	c.arg.Username = ctx.Args()[0]
	return nil
}

func (c *CmdFakeTrackingChanged) Run() (err error) {
	cli, err := GetTrackClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{}
	if err = RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	err = cli.FakeTrackingChanged(context.TODO(), c.arg)
	if err != nil {
		return err
	}
	return nil
}

func NewCmdFakeTrackingChanged(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "fake-following-changed",
		Flags: []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdFakeTrackingChangedRunner(g), "fake-following-changed", c)
		},
	}
}

func NewCmdFakeTrackingChangedRunner(g *libkb.GlobalContext) *CmdFakeTrackingChanged {
	return &CmdFakeTrackingChanged{Contextified: libkb.NewContextified(g)}
}

func (c *CmdFakeTrackingChanged) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
