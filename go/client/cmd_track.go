package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdTrack struct {
	user    string
	options keybase1.TrackOptions
}

func NewCmdTrack(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "track",
		Usage:       "keybase track <username>",
		Description: "Verify a user's authenticity and optionally track them.",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "local, l",
				Usage: "Only track locally, don't send a statement to the server.",
			},
			cli.BoolFlag{
				Name:  "y",
				Usage: "Approve remote tracking without prompting.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdTrack{}, "track", c)
		},
	}
}

func (v *CmdTrack) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Track only takes one argument, the user to track.")
	}
	v.user = ctx.Args()[0]
	v.options = keybase1.TrackOptions{LocalOnly: ctx.Bool("local"), BypassConfirm: ctx.Bool("y")}
	return nil
}

func (v *CmdTrack) Run() error {
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
		UserAssertion: v.user,
		Options:       v.options,
	})
}

func (v *CmdTrack) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
