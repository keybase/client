// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdTrack struct {
	user           string
	skipProofCache bool
	options        keybase1.TrackOptions
	libkb.Contextified
}

func NewCmdTrack(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "follow",
		ArgumentHelp: "<username>",
		Usage:        "Verify a user's authenticity and optionally follow them",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "local, l",
				Usage: "Only follow locally, don't send a public statement to the server.",
			},
			cli.BoolFlag{
				Name:  "y",
				Usage: "Approve remote following without prompting.",
			},
			cli.BoolFlag{
				Name:  "s, skip-proof-cache",
				Usage: "Skip cached proofs, force re-check",
			},
		},
		Aliases: []string{"track"},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdTrackRunner(g), "follow", c)
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
		return fmt.Errorf("Follow only takes one argument, the user to follow.")
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

	_, err = cli.Track(context.TODO(), keybase1.TrackArg{
		UserAssertion:    v.user,
		Options:          v.options,
		ForceRemoteCheck: v.skipProofCache,
	})
	return err
}

func (v *CmdTrack) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
