package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
	"github.com/keybase/go/libkb/engine"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdTrack struct {
	user      string
	assertion string
	track     bool
}

func (v *CmdTrack) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	v.track = ctx.Bool("track-statement")
	if nargs == 1 {
		v.user = ctx.Args()[0]
	} else {
		err = fmt.Errorf("track takes one arg -- the user to track")
	}
	return err
}

func (v *CmdTrack) RunClient() error {
	cli, err := GetTrackClient()
	if err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewIdentifyTrackUIProtocol(v.user),
		NewSecretUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.Track(v.user)
}

func (v *CmdTrack) Run() error {
	eng := engine.NewTrackEngine(v.user, nil, nil)
	return eng.Run()
}

func NewCmdTrack(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "track",
		Usage:       "keybase track <username>",
		Description: "verify a user's authenticity and optionally track them",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "assert, a",
				Usage: "a boolean expression on this identity",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdTrack{}, "track", c)
		},
	}
}

func (v *CmdTrack) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		Terminal:  true,
		KbKeyring: true,
	}
}
