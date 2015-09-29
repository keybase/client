package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type CmdFavoriteDelete struct {
	folder keybase1.Folder
}

func NewCmdFavoriteRemove(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "remove",
		ArgumentHelp: "<folder-name>",
		Usage:        "Remove a favorite",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdFavoriteDelete{}, "remove", c)
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
		return errors.New("Favorite remove only takes one argument, the folder name.")
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
