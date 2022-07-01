// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdAddEmail struct {
	libkb.Contextified
	Email      string
	Visibility keybase1.IdentityVisibility
}

func NewCmdAddEmail(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdAddEmail{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "add",
		Usage:        "Add email to your Keybase account",
		ArgumentHelp: "<email> <private|public>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "add", c)
		},
	}
}

func (c *CmdAddEmail) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return errors.New("invalid number of arguments.")
	}
	c.Email = ctx.Args()[0]
	visibility, ok := keybase1.IdentityVisibilityMap[strings.ToUpper(ctx.Args()[1])]
	if !ok {
		return fmt.Errorf("Unknown identity visibility: %s", visibility)
	}
	c.Visibility = visibility
	return nil
}

func (c *CmdAddEmail) Run() error {
	cli, err := GetEmailsClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.AddEmailArg{
		Email:      keybase1.EmailAddress(c.Email),
		Visibility: c.Visibility,
	}
	err = cli.AddEmail(context.Background(), arg)
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Printf("A verification code has been sent to your email.\n")
	return nil
}

func (c *CmdAddEmail) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
