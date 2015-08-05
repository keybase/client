package client

import (
	"errors"
	"path/filepath"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type CmdFavoriteList struct{}

func NewCmdFavoriteList(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "list",
		Usage:       "keybase favorite list",
		Description: "List all kbfs favorite folders",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdFavoriteList{}, "add", c)
		},
	}
}

func (c *CmdFavoriteList) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("favorite list takes zero arguments")
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
	arg := keybase1.FavoriteListArg{}
	folders, err := list(arg)
	if err != nil {
		return err
	}
	for _, f := range folders {
		acc := "public"
		if f.Private {
			acc = "private"
		}
		GlobUI.Println(filepath.Join(acc, f.Name))
	}
	return nil
}

func list(arg keybase1.FavoriteListArg) ([]keybase1.Folder, error) {
	cli, err := GetFavoriteClient()
	if err != nil {
		return nil, err
	}
	return cli.FavoriteList(0)
}
