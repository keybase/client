// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

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

type CmdSigsRevoke struct {
	queries []string
}

func (c *CmdSigsRevoke) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) == 0 {
		return fmt.Errorf("No arguments given to sigs revoke.")
	}

	for _, arg := range ctx.Args() {
		if len(arg) < keybase1.SigIDQueryMin {
			return fmt.Errorf("sig id %q is too short; must be at least 16 characters long", arg)
		}
		c.queries = append(c.queries, arg)
	}

	return nil
}

func (c *CmdSigsRevoke) Run() error {
	cli, err := GetRevokeClient()
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewSecretUIProtocol(G),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.RevokeSigs(context.TODO(), keybase1.RevokeSigsArg{
		SigIDQueries: c.queries,
	})
}

func NewCmdSigsRevoke(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "revoke",
		ArgumentHelp: "<id>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSigsRevoke{}, "revoke", c)
		},
		Flags: nil,
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
