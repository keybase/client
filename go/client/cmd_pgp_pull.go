package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdPGPPull struct {
	userAsserts []string
}

func (v *CmdPGPPull) ParseArgv(ctx *cli.Context) error {
	v.userAsserts = ctx.Args()
	return nil
}

func (v *CmdPGPPull) RunClient() (err error) {
	cli, err := GetPGPClient()
	if err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.PgpPull(keybase1.PgpPullArg{
		UserAsserts: v.userAsserts,
	})
}

func (v *CmdPGPPull) Run() error {
	arg := engine.PGPPullEngineArg{
		UserAsserts: v.userAsserts,
	}
	eng := engine.NewPGPPullEngine(&arg, G)
	ctx := engine.Context{
		LogUI: G_UI.GetLogUI(),
	}
	return engine.RunEngine(eng, &ctx)
}

func NewCmdPGPPull(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "pull",
		Usage:       "keybase pgp pull",
		Description: "Download the latest PGP keys for people you track",
		Flags:       []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPGPPull{}, "pull", c)
		},
	}
}

func (v *CmdPGPPull) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
