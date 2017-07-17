// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

const (
	PGPStorage = "pgp-storage"
)

type CmdDismiss struct {
	libkb.Contextified
	name string
}

func NewCmdDismiss(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	/* no Usage field so it doesn't show up in help */
	return cli.Command{
		Name: "dismiss",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDismiss{Contextified: libkb.NewContextified(g)}, "dismiss", c)
		},
	}
}

func (c *CmdDismiss) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("dismiss takes one argument, a notification name")
	}

	name := ctx.Args().Get(0)
	switch name {
	case PGPStorage:
		c.name = name
	default:
		return fmt.Errorf("unknown notification name %q", name)
	}

	return nil
}

func (c *CmdDismiss) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
	}
}

func (c *CmdDismiss) Run() error {
	switch c.name {
	case PGPStorage:
		cli, err := GetPGPClient(c.G())
		if err != nil {
			return err
		}
		return cli.PGPStorageDismiss(context.TODO(), 0)
	}

	return fmt.Errorf("unhandled notification name %q", c.name)
}
