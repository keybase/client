// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdFavoriteAdd struct {
	libkb.Contextified
	folder keybase1.Folder
}

func NewCmdFavoriteAdd(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "add",
		Usage:        "Add a favorite",
		ArgumentHelp: "<folder-name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdFavoriteAdd{Contextified: libkb.NewContextified(g)}, "add", c)
		},
	}
}

func (c *CmdFavoriteAdd) Run() error {
	arg := keybase1.FavoriteAddArg{
		Folder: c.folder,
	}
	cli, err := GetFavoriteClient()
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewIdentifyUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	return cli.FavoriteAdd(context.TODO(), arg)
}

func (c *CmdFavoriteAdd) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("Favorite add only takes one argument, the folder name.")
	}
	f, err := ParseTLF(ctx.Args()[0])
	if err != nil {
		return err
	}
	f.Created = true
	c.folder = f
	return nil
}

func (c *CmdFavoriteAdd) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
