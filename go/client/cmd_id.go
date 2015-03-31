package main

import (
	"fmt"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdId struct {
	user           string
	trackStatement bool
}

func (v *CmdId) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs > 1 {
		return fmt.Errorf("id takes one arg -- the user to lookup")
	}

	if nargs == 1 {
		v.user = ctx.Args()[0]
	}
	v.trackStatement = ctx.Bool("track-statement")
	return nil
}

func (v *CmdId) makeArg() *engine.IdEngineArg {
	return &engine.IdEngineArg{
		UserAssertion:  v.user,
		TrackStatement: v.trackStatement,
	}
}

func (v *CmdId) RunClient() error {
	var cli keybase_1.IdentifyClient
	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewIdentifyUIProtocol(),
	}
	cli, err := GetIdentifyClient()
	if err != nil {
		return err
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}

	arg := v.makeArg()
	_, err = cli.Identify(arg.Export())
	return err
}

func (v *CmdId) Run() error {
	logui := G.UI.GetLogUI()
	if v.trackStatement {
		logui = libkb.NewNullLogger()
	}
	eng := engine.NewIdEngine(v.makeArg())
	ctx := engine.Context{
		LogUI:      logui,
		IdentifyUI: G.UI.GetIdentifyUI(),
	}
	err := engine.RunEngine(eng, &ctx)
	return err
}

func NewCmdId(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "id",
		Usage:       "keybase id <username>",
		Description: "identify a user and check their proofs",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "t, track-statement",
				Usage: "output a JSON a track statement for this user",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdId{}, "id", c)
		},
	}
}

func (v *CmdId) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
