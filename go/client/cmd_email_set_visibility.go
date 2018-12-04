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

type CmdSetVisibilityEmail struct {
	libkb.Contextified
	Email      string
	Visibility keybase1.IdentityVisibility
}

func NewCmdSetVisibilityEmail(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdSetVisibilityEmail{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "set-visibility",
		Usage:        "Allow or disallow Keybase users from looking you up by your email. Pass 'all' to update visibility for all records.",
		ArgumentHelp: "<email|'all'> <private|public>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "set-visibility", c)
		},
	}
}

func (c *CmdSetVisibilityEmail) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return errors.New("invalid number of arguments.")
	}
	c.Email = ctx.Args()[0]
	v := ctx.Args()[1]
	var ok bool
	if c.Visibility, ok = keybase1.IdentityVisibilityMap[strings.ToUpper(v)]; !ok {
		return fmt.Errorf("Unknown identity visibility: %s", v)
	}
	return nil
}

func (c *CmdSetVisibilityEmail) Run() error {
	cli, err := GetEmailsClient(c.G())
	if err != nil {
		return err
	}
	if strings.ToLower(c.Email) == "all" {
		arg := keybase1.SetVisibilityAllEmailArg{
			Visibility: c.Visibility,
		}
		return cli.SetVisibilityAllEmail(context.Background(), arg)
	}
	arg := keybase1.SetVisibilityEmailArg{
		Email:      keybase1.EmailAddress(c.Email),
		Visibility: c.Visibility,
	}
	return cli.SetVisibilityEmail(context.Background(), arg)
}

func (c *CmdSetVisibilityEmail) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
