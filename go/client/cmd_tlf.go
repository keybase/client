// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func newCmdTlf(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "tlf",
		Usage: "Debug TLF related information",
		Subcommands: []cli.Command{
			newCmdTlfCryptKeys(cl, g),
		},
	}
}

type cmdTlfCryptKeys struct {
	libkb.Contextified
	tlfName string
}

func newCmdTlfCryptKeys(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "crypt-keys",
		Usage:        "List crypt keys of all generations for a given TLF",
		ArgumentHelp: "<tlf name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdTlfCryptKeys{Contextified: libkb.NewContextified(g)}, "crypt-keys", c)
		},
	}
}

func (c *cmdTlfCryptKeys) Run() error {
	tlfClient, err := GetTlfClient(c.G())
	if err != nil {
		return err
	}

	if err = RegisterProtocolsWithContext(nil, G); err != nil {
		return err
	}

	var results keybase1.GetTLFCryptKeysRes
	if results, err = tlfClient.CryptKeys(context.TODO(), keybase1.TLFQuery{
		TlfName:          c.tlfName,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}); err != nil {
		return err
	}

	err = json.NewEncoder(os.Stdout).Encode(results)
	if err != nil {
		return err
	}
	return nil
}

func (c *cmdTlfCryptKeys) ParseArgv(ctx *cli.Context) error {
	c.tlfName = ctx.Args().First()
	return nil
}

func (c *cmdTlfCryptKeys) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
