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

type CmdEditPhoneNumber struct {
	libkb.Contextified
	OldPhoneNumber string
	PhoneNumber    string
	Visibility     keybase1.IdentityVisibility
}

func NewCmdEditPhoneNumber(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdEditPhoneNumber{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "edit",
		Usage:        "Edit a phone number",
		ArgumentHelp: "<old phone number> <new phone number> <private|public (visibility for new phone number)>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "edit", c)
		},
	}
}

func (c *CmdEditPhoneNumber) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 3 {
		return errors.New("edit requires three arguments (old phone number, new phone number, visibility)")
	}
	c.OldPhoneNumber = ctx.Args()[0]
	c.PhoneNumber = ctx.Args()[1]
	visibility, ok := keybase1.IdentityVisibilityMap[strings.ToUpper(ctx.Args()[2])]
	if !ok {
		return fmt.Errorf("Unknown identity visibility: %s", visibility)
	}
	c.Visibility = visibility
	return nil
}

func (c *CmdEditPhoneNumber) Run() error {
	cli, err := GetPhoneNumbersClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.EditPhoneNumberArg{
		OldPhoneNumber: keybase1.PhoneNumber(c.OldPhoneNumber),
		PhoneNumber:    keybase1.PhoneNumber(c.PhoneNumber),
		Visibility:     c.Visibility,
	}
	err = cli.EditPhoneNumber(context.Background(), arg)
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Printf("A verification code has been sent to your phone number; verify with `keybase phonenumber verify <phone number> <code>.`\n")
	return nil
}

func (c *CmdEditPhoneNumber) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
