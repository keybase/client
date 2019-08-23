// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdAccountDelete struct {
	libkb.Contextified
}

func NewCmdAccountDelete(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "delete",
		Usage: "Permanently delete account",
		Action: func(c *cli.Context) {
			cmd := NewCmdAccountDeleteRunner(g)
			cl.ChooseCommand(cmd, "delete", c)
		},
	}
}

func (c *CmdAccountDelete) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("delete takes no arguments")
	}
	return nil
}

func NewCmdAccountDeleteRunner(g *libkb.GlobalContext) *CmdAccountDelete {
	return &CmdAccountDelete{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdAccountDelete) promptToConfirm() error {
	ui := c.G().UI.GetTerminalUI()
	err := ui.PromptForConfirmation("Are you sure you want to " + ColorString(c.G(), "red", "permanently delete") + " your account?")
	if err != nil {
		return err
	}
	cli, err := GetUserClient(c.G())
	if err != nil {
		return err
	}
	randomPW, err := cli.LoadHasRandomPw(context.Background(), keybase1.LoadHasRandomPwArg{})
	if err != nil {
		return err
	}
	if randomPW {
		expected := fmt.Sprintf("I want to delete my account %s", c.G().Env.GetUsername().String())
		promptStr := fmt.Sprintf("Please type '%s' to confirm: ", expected)
		ret, err := ui.Prompt(PromptDescriptorAccountDeleteConfirmation, promptStr)
		if err != nil {
			return err
		}
		if ret != expected {
			return errors.New("Input did not match expected text")
		}
	}
	return nil
}

func (c *CmdAccountDelete) Run() error {
	err := c.promptToConfirm()
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	cli, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}
	err = cli.AccountDelete(context.Background(), 0)
	if err != nil {
		return err
	}
	c.G().UI.GetDumbOutputUI().PrintfStderr("Account deleted.\n")
	return nil
}

func (c *CmdAccountDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
