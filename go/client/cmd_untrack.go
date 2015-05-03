package client

import (
	"fmt"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdUntrack struct {
	user string
}

func NewCmdUntrack(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "untrack",
		Usage:       "keybase untrack <username>",
		Description: "untrack a user",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdUntrack{}, "untrack", c)
		},
	}
}

func (v *CmdUntrack) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("untrack takes one arg -- the user to untrack")
	}
	v.user = ctx.Args()[0]
	return nil
}

func (v *CmdUntrack) RunClient() error {
	cli, err := GetTrackClient()
	if err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
		NewSecretUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.Untrack(keybase_1.UntrackArg{
		TheirName: v.user,
	})
}

func (v *CmdUntrack) Run() error {
	arg := engine.UntrackEngineArg{
		TheirName: v.user,
	}
	eng := engine.NewUntrackEngine(&arg)
	ctx := engine.Context{
		SecretUI: G_UI.GetSecretUI(),
	}
	return engine.RunEngine(eng, &ctx)
}

func (v *CmdUntrack) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
