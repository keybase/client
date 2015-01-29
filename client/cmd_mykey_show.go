package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func (v *CmdMykeyShow) RunClient() (err error) {
	var cli keybase_1.MykeyClient
	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
	}
	if cli, err = GetMykeyClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {
	} else {
		err = cli.Show()
	}
	return
}

func (v *CmdMykeyShow) Run() (err error) {
	return libkb.ShowKeys(G.UI.GetLogUI())
}

type CmdMykeyShow struct{}

func (d *CmdMykeyShow) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if nargs != 0 {
		err = BadArgsError("show doesn't take arguments")
	}
	return err
}

func NewCmdMykeyShow(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "show",
		Usage:       "keybase mykey show",
		Description: "Show the status of your key family",
		Flags:       []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdMykeyShow{}, "show", c)
		},
	}
}

func (v *CmdMykeyShow) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   true,
	}
}
