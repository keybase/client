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

type CmdDeletePhoneNumber struct {
	libkb.Contextified
	PhoneNumber string
}

func NewCmdDeletePhoneNumber(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdDeletePhoneNumber{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "delete",
		Usage:        "Delete phone number from your Keybase account",
		ArgumentHelp: "<phone number>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "delete", c)
		},
	}
}

func (c *CmdDeletePhoneNumber) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("delete requires one argument (phone number)")
	}
	c.PhoneNumber = ctx.Args()[0]
	return nil
}

func (c *CmdDeletePhoneNumber) Run() error {
	cli, err := GetPhoneNumbersClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.DeletePhoneNumberArg{
		PhoneNumber: keybase1.PhoneNumber(c.PhoneNumber),
	}
	return cli.DeletePhoneNumber(context.Background(), arg)
}

func (c *CmdDeletePhoneNumber) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
