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
)

type CmdFavoriteRemove struct {
	folder keybase1.Folder
}

func NewCmdFavoriteRemove(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "remove",
		ArgumentHelp: "<folder-name>",
		Usage:        "Remove a favorite",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdFavoriteRemove{}, "remove", c)
		},
	}
}

func (c *CmdFavoriteRemove) Run() error {
	arg := keybase1.FavoriteIgnoreArg{
		Folder: c.folder,
	}
	cli, err := GetFavoriteClient()
	if err != nil {
		return err
	}
	// The "remove" command becomes an "ignore" row in the database. If we
	// actually deleted the row, it would make the folder in question appear
	// "new" instead.
	return cli.FavoriteIgnore(context.TODO(), arg)
}

func (c *CmdFavoriteRemove) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("Favorite remove only takes one argument, the folder name.")
	}
	f, err := ParseTLF(ctx.Args()[0])
	if err != nil {
		return err
	}
	c.folder = f
	return nil
}

func (c *CmdFavoriteRemove) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
