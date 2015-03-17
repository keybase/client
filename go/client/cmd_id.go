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
	user      string
	uid       *libkb.UID
	assertion string
	track     bool
	luba      bool
	loadSelf  bool
}

func (v *CmdId) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	v.track = ctx.Bool("track-statement")
	v.luba = ctx.Bool("luba")
	v.loadSelf = ctx.Bool("load-self")
	byUid := ctx.Bool("uid")
	if nargs == 1 {
		if byUid {
			v.uid, err = libkb.UidFromHex(ctx.Args()[0])
		} else {
			v.user = ctx.Args()[0]
		}
	} else if nargs != 0 || v.luba {
		err = fmt.Errorf("id takes one arg -- the user to lookup")
	}
	return err
}

func (v *CmdId) makeArg() *engine.IdEngineArg {
	return &engine.IdEngineArg{
		Uid:            v.uid,
		User:           v.user,
		TrackStatement: v.track,
		Luba:           v.luba,
		LoadSelf:       v.loadSelf,
	}
}

func (v *CmdId) RunClient() (err error) {
	var cli keybase_1.IdentifyClient
	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewIdentifyUIProtocol(),
	}
	if cli, err = GetIdentifyClient(); err != nil {
	} else if err = RegisterProtocols(protocols); err != nil {
	} else {
		arg := v.makeArg()
		_, err = cli.Identify(arg.Export())
	}
	return
}

func (v *CmdId) Run() error {
	eng := engine.NewIdEngine(v.makeArg())
	ctx := engine.Context{
		LogUI:      G_UI.GetLogUI(),
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
			cli.StringFlag{
				Name:  "assert, a",
				Usage: "a boolean expression on this identity",
			},
			cli.BoolFlag{
				Name:  "t, track-statement",
				Usage: "output a JSON a track statement for this user",
			},
			cli.BoolFlag{
				Name:  "l, luba",
				Usage: "LookupUserByAssertion",
			},
			cli.BoolFlag{
				Name:  "s, load-self",
				Usage: "Load self for tracking statement",
			},
			cli.BoolFlag{
				Name:  "i, uid",
				Usage: "Load user by UID",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdId{}, "id", c)
		},
	}
}

func (v *CmdId) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   false,
	}
}
