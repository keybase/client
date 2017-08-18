// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/hex"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdSecretKey struct {
	libkb.Contextified
	keytype string
}

func (c *CmdSecretKey) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("Must specify either 'encryption' or 'signing'.")
	}
	arg := ctx.Args()[0]
	if arg == "encryption" || arg == "signing" {
		c.keytype = arg
	} else {
		return fmt.Errorf("Must specify either 'encryption' or 'signing'.")
	}
	return nil
}

func (c *CmdSecretKey) Run() (err error) {
	cli, err := GetSecretKeysClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err = RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	keys, err := cli.GetSecretKeys(context.TODO(), 0 /* SessionID */)
	if err != nil {
		return err
	}

	if c.keytype == "encryption" {
		fmt.Println(hex.EncodeToString(keys.Encryption[:]))
	} else {
		fmt.Println(hex.EncodeToString(keys.Signing[:]))
	}
	return nil
}

func NewCmdSecretKey(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "secretkey",
		Flags: []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdSecretKeyRunner(g), "secretkeys", c)
		},
	}
}

func NewCmdSecretKeyRunner(g *libkb.GlobalContext) *CmdSecretKey {
	return &CmdSecretKey{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdSecretKey) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
