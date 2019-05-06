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

type CmdSendVerificationEmail struct {
	libkb.Contextified
	Email keybase1.EmailAddress
}

func NewCmdSendVerificationEmail(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdSendVerificationEmail{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "send-verification-email",
		Usage:        "Send a verification email to an email address.",
		ArgumentHelp: "<email>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "send-verification-email", c)
		},
	}
}

func (c *CmdSendVerificationEmail) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("invalid number of arguments.")
	}
	c.Email = keybase1.EmailAddress(ctx.Args()[0])
	return nil
}

func (c *CmdSendVerificationEmail) Run() error {
	cli, err := GetEmailsClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.SendVerificationEmailArg{
		Email: c.Email,
	}
	err = cli.SendVerificationEmail(context.Background(), arg)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdSendVerificationEmail) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
