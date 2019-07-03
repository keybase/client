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

type CmdAddPhoneNumber struct {
	libkb.Contextified
	PhoneNumber string
	Visibility  keybase1.IdentityVisibility
}

func NewCmdAddPhoneNumber(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdAddPhoneNumber{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "add",
		Usage:        "Add phone number to your Keybase account or resend verification text",
		ArgumentHelp: "<phone number> <private|public>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "add", c)
		},
	}
}

func (c *CmdAddPhoneNumber) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return errors.New("add requires two arguments (phone number, visibility)")
	}
	c.PhoneNumber = ctx.Args()[0]
	visibility, ok := keybase1.IdentityVisibilityMap[strings.ToUpper(ctx.Args()[1])]
	if !ok {
		return fmt.Errorf("Unknown identity visibility: %s", visibility)
	}
	c.Visibility = visibility
	return nil
}

func (c *CmdAddPhoneNumber) Run() error {
	cli, err := GetPhoneNumbersClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.AddPhoneNumberArg{
		PhoneNumber: keybase1.PhoneNumber(c.PhoneNumber),
		Visibility:  c.Visibility,
	}
	err = cli.AddPhoneNumber(context.Background(), arg)
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Printf("A verification code has been sent to your phone number; verify with `keybase phonenumber verify <phone number> <code>.`\n")
	return nil
}

func (c *CmdAddPhoneNumber) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
