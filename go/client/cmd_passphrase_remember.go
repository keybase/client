// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strconv"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdPassphraseRemember struct {
	libkb.Contextified
	newValue *bool
	json     bool
}

func NewCmdPassphraseRemember(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "remember",
		ArgumentHelp: "[<true|false>]",
		Usage:        "Set whether your account passphrase should be remembered across restarts. Run with no arguments to check status.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdPassphraseRememberRunner(g), "change", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "If no new value is provided, output the current status as a JSON boolean",
			},
		},
	}
}

func NewCmdPassphraseRememberRunner(g *libkb.GlobalContext) *CmdPassphraseRemember {
	return &CmdPassphraseRemember{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdPassphraseRemember) Run() error {
	ctx := context.Background()
	ui := c.G().UI.GetTerminalUI()
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	cfg, err := GetConfigClient(c.G())
	if err != nil {
		return err
	}

	if c.newValue == nil {
		currentVal, err := cfg.GetRememberPassphrase(ctx, 0)
		if err != nil {
			return err
		}

		if c.json {
			dui := c.G().UI.GetDumbOutputUI()
			_, err = dui.Printf(strconv.FormatBool(currentVal) + "\n")
			return err
		}

		if currentVal {
			ui.Printf(`Your current account will always stay logged in.
You won't be asked for your password when restarting the app or your device.
`)
			return nil
		}

		ui.Printf(`Your current account will be logged out when you restart the app or your device.`)
		return nil
	}

	newValue := *c.newValue
	if err := cfg.SetRememberPassphrase(ctx, keybase1.SetRememberPassphraseArg{
		Remember: newValue,
	}); err != nil {
		return err
	}

	if newValue {
		ui.Printf("This account will now stay logged in across restarts.\n")
	} else {
		ui.Printf("You will now be asked for your password when restarting the app.\n")
	}
	return nil
}

func (c *CmdPassphraseRemember) ParseArgv(ctx *cli.Context) error {
	c.json = ctx.Bool("json")

	newValStr := ctx.Args().First()
	if newValStr == "" {
		return nil
	}
	newVal, err := strconv.ParseBool(newValStr)
	if err != nil {
		return fmt.Errorf("Invalid argument syntax: %v", err)
	}
	c.newValue = &newVal
	return nil
}

func (c *CmdPassphraseRemember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
