// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// CmdSimpleFSUpgrade is the 'fs upgrade' command.
type CmdSimpleFSUpgrade struct {
	libkb.Contextified
	tlfName string
	public  bool
}

// NewCmdSimpleFSUpgrade creates a new cli.Command.
func NewCmdSimpleFSUpgrade(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "upgrade",
		Usage: "upgrade a KBFS TLF to use implicit team keys",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSUpgrade{Contextified: libkb.NewContextified(g)}, "upgrade", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "public",
				Usage: "specify a public TLF name",
			},
		},
	}
}

func (c *CmdSimpleFSUpgrade) Run() error {
	cli, err := GetKBFSClient(c.G())
	if err != nil {
		return err
	}
	return cli.UpgradeTLF(context.TODO(), keybase1.UpgradeTLFArg{
		TlfName: c.tlfName,
		Public:  c.public,
	})
}

func (c *CmdSimpleFSUpgrade) ParseArgv(ctx *cli.Context) error {

	if len(ctx.Args()) == 0 {
		return errors.New("must specify a TLF name")
	}
	c.tlfName = ctx.Args().Get(0)
	c.public = ctx.Bool("public")

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSUpgrade) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
