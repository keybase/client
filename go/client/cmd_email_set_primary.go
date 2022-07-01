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

type CmdSetPrimaryEmail struct {
	libkb.Contextified
	Email string
}

func NewCmdSetPrimaryEmail(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdSetPrimaryEmail{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "set-primary",
		Usage:        "Set an email as the primary to receive notifications from Keybase",
		ArgumentHelp: "<email>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "set-primary", c)
		},
	}
}

func (c *CmdSetPrimaryEmail) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("invalid number of arguments.")
	}
	c.Email = ctx.Args()[0]
	return nil
}

func (c *CmdSetPrimaryEmail) Run() error {
	cli, err := GetEmailsClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.SetPrimaryEmailArg{
		Email: keybase1.EmailAddress(c.Email),
	}
	return cli.SetPrimaryEmail(context.Background(), arg)
}

func (c *CmdSetPrimaryEmail) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
