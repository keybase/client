package client

import (
	"errors"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type CmdFavoriteDelete struct {
	folder keybase1.Folder
}

func NewCmdFavoriteDelete(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "delete",
		Usage:       "keybase favorite delete",
		Description: "Unfavorite a kbfs folder",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdFavoriteDelete{}, "delete", c)
		},
	}
}

func (c *CmdFavoriteDelete) Run() error {
	arg := keybase1.FavoriteDeleteArg{
		Folder: c.folder,
	}
	cli, err := GetFavoriteClient()
	if err != nil {
		return err
	}
	return cli.FavoriteDelete(arg)
}

func (c *CmdFavoriteDelete) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("favorite delete takes 1 argument: <folder name>")
	}
	f, err := ParseTLF(ctx.Args()[0])
	if err != nil {
		return err
	}
	c.folder = f
	return nil
}

func (c *CmdFavoriteDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
