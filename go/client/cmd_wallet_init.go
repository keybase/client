// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type cmdWalletInit struct {
	libkb.Contextified
}

func newCmdWalletInit(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletInit{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:  "init",
		Usage: "Initialize your cryptocurrency wallet (dev only)",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "init", c)
		},
		Description: "Initialize your cryptocurrency wallet (dev only)",
	}
}

func (v *cmdWalletInit) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 0 {
		return errors.New("no args required")
	}
	return nil
}

func (v *cmdWalletInit) Run() (err error) {
	cli, err := GetWalletClient(v.G())
	if err != nil {
		return err
	}
	return cli.WalletInit(context.TODO())
}

func (v *cmdWalletInit) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
