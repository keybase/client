// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type CmdTrack struct {
	user           string
	skipProofCache bool
	options        keybase1.TrackOptions
	libkb.Contextified
}

func NewCmdTrack(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "track",
		ArgumentHelp: "<username>",
		Usage:        "Verify a user's authenticity and optionally track them",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "local, l",
				Usage: "Only track locally, don't send a statement to the server.",
			},
			cli.BoolFlag{
				Name:  "y",
				Usage: "Approve remote tracking without prompting.",
			},
			cli.BoolFlag{
				Name:  "s, skip-proof-cache",
				Usage: "Skip cached proofs, force re-check",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdTrackRunner(g), "track", c)
		},
	}
}

func NewCmdTrackRunner(g *libkb.GlobalContext) *CmdTrack {
	return &CmdTrack{Contextified: libkb.NewContextified(g)}
}

func (v *CmdTrack) SetUser(user string) {
	v.user = user
}

func (v *CmdTrack) SetOptions(options keybase1.TrackOptions) {
	v.options = options
}

func (v *CmdTrack) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Track only takes one argument, the user to track.")
	}
	v.user = ctx.Args()[0]
	v.options = keybase1.TrackOptions{LocalOnly: ctx.Bool("local"), BypassConfirm: ctx.Bool("y")}
	v.skipProofCache = ctx.Bool("skip-proof-cache")
	return nil
}

func (v *CmdTrack) Run() error {
	cli, err := GetTrackClient(v.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewIdentifyTrackUIProtocol(v.G()),
		NewSecretUIProtocol(v.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, v.G()); err != nil {
		return err
	}

	return cli.Track(context.TODO(), keybase1.TrackArg{
		UserAssertion:    v.user,
		Options:          v.options,
		ForceRemoteCheck: v.skipProofCache,
	})
}

func (v *CmdTrack) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
