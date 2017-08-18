// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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

type CmdUntrack struct {
	user string
	libkb.Contextified
}

func NewCmdUntrack(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "unfollow",
		ArgumentHelp: "<username>",
		Usage:        "Unfollow a user",
		Aliases:      []string{"untrack"},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdUntrack{Contextified: libkb.NewContextified(g)}, "unfollow", c)
		},
	}
}

func (v *CmdUntrack) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Unfollow only takes one argument, the user to unfollow.")
	}
	v.user = ctx.Args()[0]
	return nil
}

func (v *CmdUntrack) Run() error {
	cli, err := GetTrackClient(v.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewSecretUIProtocol(G),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.Untrack(context.TODO(), keybase1.UntrackArg{
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
