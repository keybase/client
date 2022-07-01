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

type CmdDeleteEmail struct {
	libkb.Contextified
	Email string
}

func NewCmdDeleteEmail(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdDeleteEmail{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "delete",
		Usage:        "Delete email from your Keybase account",
		ArgumentHelp: "<email>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "delete", c)
		},
	}
}

func (c *CmdDeleteEmail) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("invalid number of arguments.")
	}
	c.Email = ctx.Args()[0]
	return nil
}

func (c *CmdDeleteEmail) Run() error {
	cli, err := GetEmailsClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.DeleteEmailArg{
		Email: keybase1.EmailAddress(c.Email),
	}
	return cli.DeleteEmail(context.Background(), arg)
}

func (c *CmdDeleteEmail) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
