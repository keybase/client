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

type CmdSetVisibilityPhoneNumber struct {
	libkb.Contextified
	PhoneNumber string
	Visibility  keybase1.IdentityVisibility
}

func NewCmdSetVisibilityPhoneNumber(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdSetVisibilityPhoneNumber{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "set-visibility",
		Usage:        "Allow or disallow Keybase users from looking you up by your phone number. Pass 'all' to update visibility for all records.",
		ArgumentHelp: "<phone number|'all'> <private|public>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "set-visibility", c)
		},
	}
}

func (c *CmdSetVisibilityPhoneNumber) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return errors.New("set-visibility requires two arguments (phone number, visibility)")
	}
	c.PhoneNumber = ctx.Args()[0]
	v := ctx.Args()[1]
	var ok bool
	if c.Visibility, ok = keybase1.IdentityVisibilityMap[strings.ToUpper(v)]; !ok {
		return fmt.Errorf("Unknown identity visibility: %s", v)
	}
	return nil
}

func (c *CmdSetVisibilityPhoneNumber) Run() error {
	cli, err := GetPhoneNumbersClient(c.G())
	if err != nil {
		return err
	}
	if strings.ToLower(c.PhoneNumber) == "all" {
		arg := keybase1.SetVisibilityAllPhoneNumberArg{
			Visibility: c.Visibility,
		}
		return cli.SetVisibilityAllPhoneNumber(context.Background(), arg)
	}
	arg := keybase1.SetVisibilityPhoneNumberArg{
		PhoneNumber: keybase1.PhoneNumber(c.PhoneNumber),
		Visibility:  c.Visibility,
	}
	return cli.SetVisibilityPhoneNumber(context.Background(), arg)
}

func (c *CmdSetVisibilityPhoneNumber) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
