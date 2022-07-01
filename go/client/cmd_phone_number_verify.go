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

type CmdVerifyPhoneNumber struct {
	libkb.Contextified
	PhoneNumber string
	Code        string
}

func NewCmdVerifyPhoneNumber(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdVerifyPhoneNumber{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "verify",
		Usage:        "Verify phone number",
		ArgumentHelp: "<phone number> <code>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "verify", c)
		},
	}
}

func (c *CmdVerifyPhoneNumber) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return errors.New("verify requires two arguments: <phone number> <code>")
	}
	c.PhoneNumber = ctx.Args()[0]
	c.Code = ctx.Args()[1]
	return nil
}

func (c *CmdVerifyPhoneNumber) Run() error {
	cli, err := GetPhoneNumbersClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.VerifyPhoneNumberArg{
		PhoneNumber: keybase1.PhoneNumber(c.PhoneNumber),
		Code:        c.Code,
	}
	return cli.VerifyPhoneNumber(context.Background(), arg)
}

func (c *CmdVerifyPhoneNumber) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
