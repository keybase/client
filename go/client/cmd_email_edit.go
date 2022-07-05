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

type CmdEditEmail struct {
	libkb.Contextified
	OldEmail   string
	Email      string
	Visibility keybase1.IdentityVisibility
}

func NewCmdEditEmail(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdEditEmail{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "edit",
		Usage:        "Edit a email",
		ArgumentHelp: "<old email> <new email> <private|public (visibility for new email)>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "edit", c)
		},
	}
}

func (c *CmdEditEmail) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 3 {
		return errors.New("invalid number of arguments.")
	}
	c.OldEmail = ctx.Args()[0]
	c.Email = ctx.Args()[1]
	visibility, ok := keybase1.IdentityVisibilityMap[strings.ToUpper(ctx.Args()[2])]
	if !ok {
		return fmt.Errorf("Unknown identity visibility: %s", visibility)
	}
	c.Visibility = visibility
	return nil
}

func (c *CmdEditEmail) Run() error {
	cli, err := GetEmailsClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.EditEmailArg{
		OldEmail:   keybase1.EmailAddress(c.OldEmail),
		Email:      keybase1.EmailAddress(c.Email),
		Visibility: c.Visibility,
	}
	err = cli.EditEmail(context.Background(), arg)
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Printf("A verification code has been sent to your email.\n")
	return nil
}

func (c *CmdEditEmail) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
