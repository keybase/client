// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdDumpPushNotifications struct {
	libkb.Contextified
	pretty bool
}

func (c *CmdDumpPushNotifications) ParseArgv(ctx *cli.Context) error {
	c.pretty = ctx.Bool("pretty")
	return nil
}

func (c *CmdDumpPushNotifications) Run() error {

	cli, err := GetGregorClient(c.G())
	if err != nil {
		return err
	}

	state, err := cli.GetState(context.TODO())
	if err != nil {
		return err
	}
	var jsonOut []byte
	if c.pretty {
		jsonOut, err = json.MarshalIndent(state, "", "    ")
	} else {
		jsonOut, err = json.Marshal(state)
	}
	if err != nil {
		return err
	}

	c.G().UI.GetTerminalUI().Output(string(jsonOut) + "\n")
	return nil
}
func NewCmdDumpPushNotificationsRunner(g *libkb.GlobalContext) *CmdDumpPushNotifications {
	return &CmdDumpPushNotifications{Contextified: libkb.NewContextified(g)}
}

func NewCmdDumpPushNotifications(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	ret := cli.Command{
		Name:        "dump-push-notifications",
		Description: "Dump pending push notifications for a given user",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "pretty",
				Usage: "Pretty-printed JSON",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdDumpPushNotificationsRunner(g), "dump-push-notifications", c)
		},
	}
	return ret
}

func (c *CmdDumpPushNotifications) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
