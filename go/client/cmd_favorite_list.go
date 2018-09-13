// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"path/filepath"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CmdFavoriteList struct {
	libkb.Contextified
}

func NewCmdFavoriteList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "list",
		Usage: "List favorites",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdFavoriteList{Contextified: libkb.NewContextified(g)}, "add", c)
		},
	}
}

func (c *CmdFavoriteList) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("Favorite list doesn't take any arguments")
	}
	return nil
}

func (c *CmdFavoriteList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdFavoriteList) Run() error {
	arg := keybase1.GetFavoritesArg{}
	result, err := list(c.G(), arg)
	if err != nil {
		return err
	}
	for _, f := range result.FavoriteFolders {
		acc := "public"
		if f.Private {
			acc = "private"
		}
		c.G().UI.GetTerminalUI().Printf("%s\n", filepath.Join(acc, f.Name))
	}
	return nil
}

func list(g *libkb.GlobalContext, arg keybase1.GetFavoritesArg) (keybase1.FavoritesResult, error) {
	cli, err := GetFavoriteClient(g)
	if err != nil {
		return keybase1.FavoritesResult{}, err
	}
	return cli.GetFavorites(context.TODO(), 0)
}
