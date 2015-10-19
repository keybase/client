package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type CmdFavoriteAdd struct {
	folder keybase1.Folder
}

func NewCmdFavoriteAdd(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "add",
		Usage:        "Add a favorite",
		ArgumentHelp: "<folder-name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdFavoriteAdd{}, "add", c)
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
	c.folder = f
	return nil
}

func (c *CmdFavoriteAdd) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
