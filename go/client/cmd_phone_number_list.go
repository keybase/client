// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type CmdListPhoneNumbers struct {
	libkb.Contextified
	json bool
}

func NewCmdListPhoneNumbers(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdListPhoneNumbers{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:  "list",
		Usage: "List phone numbers attached to your account",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output as JSON",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "list", c)
		},
	}
}

func (c *CmdListPhoneNumbers) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("list takes no positional arguments")
	}
	c.json = ctx.Bool("json")
	return nil
}

func (c *CmdListPhoneNumbers) Run() error {
	cli, err := GetPhoneNumbersClient(c.G())
	if err != nil {
		return err
	}
	resp, err := cli.GetPhoneNumbers(context.Background(), 0)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	if c.json {
		b, err := json.Marshal(resp)
		if err != nil {
			return err
		}
		ui.Printf("%s\n", string(b))
		return nil
	}

	for _, p := range resp {
		ui.Printf("%s (verified: %t, added on: %s)\n", p.PhoneNumber,
			p.Verified, p.Ctime.Time().Format("2006-01-02"))
	}
	return nil
}

func (c *CmdListPhoneNumbers) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
