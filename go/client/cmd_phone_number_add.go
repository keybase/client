// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdAddPhoneNumber struct {
	libkb.Contextified
	PhoneNumber string
}

func NewCmdAddPhoneNumber(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdAddPhoneNumber{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "add",
		Usage:        "Add phone number to your Keybase account",
		ArgumentHelp: "<phone number>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "add", c)
		},
	}
}

func (c *CmdAddPhoneNumber) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("add requires one argument (phone number)")
	}
	c.PhoneNumber = ctx.Args()[0]
	return nil
}

func (c *CmdAddPhoneNumber) Run() error {
	cli, err := GetPhoneNumbersClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.AddPhoneNumberArg{
		PhoneNumber: keybase1.PhoneNumber(c.PhoneNumber),
	}
	return cli.AddPhoneNumber(context.Background(), arg)
}

func (c *CmdAddPhoneNumber) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
