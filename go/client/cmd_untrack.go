// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

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
