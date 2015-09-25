package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdUntrack struct {
	user string
}

func NewCmdUntrack(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "untrack",
		ArgumentHelp: "<username>",
		Usage:        "Untrack a user",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdUntrack{}, "untrack", c)
		},
	}
}

func (v *CmdUntrack) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Untrack only takes one argument, the user to untrack.")
	}
	v.user = ctx.Args()[0]
	return nil
}

func (v *CmdUntrack) Run() error {
	cli, err := GetTrackClient()
	if err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
		NewSecretUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.Untrack(keybase1.UntrackArg{
		Username: v.user,
	})
}

func (v *CmdUntrack) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
