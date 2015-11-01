// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

func NewCmdDoctor(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "doctor",
		Usage: "Checks your environment and offers to fix any issues",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDoctor{}, "doctor", c)
		},
	}
}

type CmdDoctor struct{}

func (c *CmdDoctor) Run() error {
	cli, err := GetDoctorClient()
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewDoctorUIProtocol(),
		NewSecretUIProtocol(G),
		NewLocksmithUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	return cli.Doctor(context.TODO(), 0)
}

func (c *CmdDoctor) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdDoctor) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
