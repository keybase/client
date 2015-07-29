package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type CmdFavoriteDelete struct {
	name string
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
	return c.run(&favRemoveStandalone{})
}

func (c *CmdFavoriteDelete) RunClient() error {
	return c.run(&favRemoveClient{})
}

func (c *CmdFavoriteDelete) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdFavoriteDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdFavoriteDelete) run(remover favRemover) error {
	arg := keybase1.FavoriteDeleteArg{
		Folder: keybase1.Folder{
			Name: c.name,
		},
	}
	return remover.remove(arg)
}

// delete is a reserved word...
type favRemover interface {
	remove(arg keybase1.FavoriteDeleteArg) error
}

type favRemoveStandalone struct{}

func (f *favRemoveStandalone) remove(arg keybase1.FavoriteDeleteArg) error {
	ctx := &engine.Context{}
	eng := engine.NewFavoriteDelete(&arg, G)
	return engine.RunEngine(eng, ctx)
}

type favRemoveClient struct{}

func (f *favRemoveClient) remove(arg keybase1.FavoriteDeleteArg) error {
	cli, err := GetFavoriteClient()
	if err != nil {
		return err
	}
	return cli.FavoriteDelete(arg)
}
