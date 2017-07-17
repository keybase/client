// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdRekeyPaper struct {
	libkb.Contextified
}

func NewCmdRekeyPaper(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "paper",
		Usage: "Submit a paper key to help rekeying",
		Action: func(c *cli.Context) {
			cmd := &CmdRekeyPaper{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "paper", c)
		},
	}
}

func (c *CmdRekeyPaper) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("paper")
	}
	return nil
}

func (c *CmdRekeyPaper) Run() error {
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	phrase, err := PromptPaperPhrase(c.G())
	if err != nil {
		return err
	}

	cli, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.PaperKeySubmitArg{
		PaperPhrase: phrase,
	}
	return cli.PaperKeySubmit(context.Background(), arg)
}

func (c *CmdRekeyPaper) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}
