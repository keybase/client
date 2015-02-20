package main

import (
	"fmt"

	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
	"github.com/keybase/go/engine"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdMykeySelect struct {
	state MyKeyState
	query string
}

func (v *CmdMykeySelect) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if err = v.state.ParseArgv(ctx); err != nil {
	} else if nargs == 1 {
		v.query = ctx.Args()[0]
	} else if nargs != 0 {
		err = fmt.Errorf("mkey select takes 0 or 1 arguments")
	}
	return err
}

func (v *CmdMykeySelect) RunClient() error {
	c, err := GetMykeyClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewGPGUIProtocol(),
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return c.Select(v.query)
}

func (v *CmdMykeySelect) Run() error {
	ctx := engine.NewContext(G.UI.GetGPGUI(), G.UI.GetSecretUI())
	gpg := engine.NewGPG()
	arg := engine.GPGArg{Query: v.query, LoadDeviceKey: true}
	return engine.RunEngine(gpg, ctx, arg, nil)
}

func NewCmdMykeySelect(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "select",
		Usage:       "keybase mykey select [<key-query>]",
		Description: "Select a key as your own and push it to the server",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdMykeySelect{}, "select", c)
		},
		Flags: mykeyFlags(),
	}
}

func (v *CmdMykeySelect) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
		Terminal:  true,
	}
}
