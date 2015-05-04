package client

import (
	"fmt"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdTrack struct {
	user          string
	localOnly     bool
	approveRemote bool
}

func NewCmdTrack(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "track",
		Usage:       "keybase track <username>",
		Description: "verify a user's authenticity and optionally track them",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "local, l",
				Usage: "only track locally, no statement sent to remote server",
			},
			cli.BoolFlag{
				Name:  "y",
				Usage: "approve remote tracking without prompting",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdTrack{}, "track", c)
		},
	}
}

func (v *CmdTrack) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("track takes one arg -- the user to track")
	}
	v.user = ctx.Args()[0]
	v.localOnly = ctx.Bool("local")
	v.approveRemote = ctx.Bool("y")
	return nil
}

func (v *CmdTrack) RunClient() error {
	cli, err := GetTrackClient()
	if err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewIdentifyTrackUIProtocol(),
		NewSecretUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.Track(keybase1.TrackArg{
		TheirName:     v.user,
		LocalOnly:     v.localOnly,
		ApproveRemote: v.approveRemote,
	})
}

func (v *CmdTrack) Run() error {
	arg := engine.TrackEngineArg{
		TheirName: v.user,
		Options: engine.TrackOptions{
			TrackLocalOnly: v.localOnly,
			TrackApprove:   v.approveRemote,
		},
	}
	eng := engine.NewTrackEngine(&arg)
	ctx := engine.Context{
		SecretUI:   G_UI.GetSecretUI(),
		IdentifyUI: G_UI.GetIdentifyTrackUI(true),
	}
	return engine.RunEngine(eng, &ctx)
}

func (v *CmdTrack) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
