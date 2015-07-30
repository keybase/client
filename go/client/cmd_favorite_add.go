package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type CmdFavoriteAdd struct {
	folder keybase1.Folder
}

func NewCmdFavoriteAdd(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "add",
		Usage:       "keybase favorite add",
		Description: "Add a new kbfs favorite folder",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdFavoriteAdd{}, "add", c)
		},
	}
}

func (c *CmdFavoriteAdd) Run() error {
	return c.run(&favAddStandalone{})
}

func (c *CmdFavoriteAdd) RunClient() error {
	return c.run(&favAddClient{})
}

func (c *CmdFavoriteAdd) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("favorite add takes 1 argument: <folder name>")
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

func (c *CmdFavoriteAdd) run(adder favAdder) error {
	arg := keybase1.FavoriteAddArg{
		Folder: c.folder,
	}
	return adder.add(arg)
}

type favAdder interface {
	add(arg keybase1.FavoriteAddArg) error
}

type favAddStandalone struct{}

func (f *favAddStandalone) add(arg keybase1.FavoriteAddArg) error {
	ctx := &engine.Context{}
	eng := engine.NewFavoriteAdd(&arg, G)
	return engine.RunEngine(eng, ctx)
}

type favAddClient struct{}

func (f *favAddClient) add(arg keybase1.FavoriteAddArg) error {
	cli, err := GetFavoriteClient()
	if err != nil {
		return err
	}
	return cli.FavoriteAdd(arg)
}
