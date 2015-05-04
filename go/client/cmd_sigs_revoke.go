package client

import (
	"fmt"
	"strconv"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdSigsRevoke struct {
	sigIDs []string
	seqnos []int
}

func (c *CmdSigsRevoke) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) == 0 {
		return fmt.Errorf("No arguments given to sigs revoke.")
	}
	if ctx.Bool("seqno") {
		for _, arg := range ctx.Args() {
			num, err := strconv.ParseUint(arg, 10 /* base */, 32 /* size */)
			if err != nil {
				return err
			}
			c.seqnos = append(c.seqnos, int(num))
		}
	} else {
		for _, arg := range ctx.Args() {
			c.sigIDs = append(c.sigIDs, arg)
		}

	}
	return nil
}

func (c *CmdSigsRevoke) RunClient() error {
	cli, err := GetRevokeClient()
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

	return cli.RevokeSigs(keybase1.RevokeSigsArg{
		Ids:    c.sigIDs,
		Seqnos: c.seqnos,
	})
}

func (c *CmdSigsRevoke) Run() error {
	eng := engine.NewRevokeSigsEngine(c.sigIDs, c.seqnos)
	ctx := engine.Context{
		LogUI:    G_UI.GetLogUI(),
		SecretUI: G_UI.GetSecretUI(),
	}
	return engine.RunEngine(eng, &ctx)
}

func NewCmdSigsRevoke(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "revoke",
		Usage: "keybase sigs revoke [--seqno] ARGS...",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSigsRevoke{}, "revoke", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "seqno",
				Usage: "Interpret args as signature sequence numbers, rather than sig IDs.",
			},
		},
	}
}

func (c *CmdSigsRevoke) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
