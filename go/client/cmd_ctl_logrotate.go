// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

func NewCmdCtlLogRotate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "log-rotate",
		Usage: "Close and open the keybase service's log file",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlLogRotate{libkb.NewContextified(g)}, "log-rotate", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlLogRotate struct {
	libkb.Contextified
}

func (s *CmdCtlLogRotate) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlLogRotate) Run() (err error) {
	cli, err := GetCtlClient(s.G())
	if err != nil {
		return err
	}
	return cli.LogRotate(context.TODO(), 0)
}

func (s *CmdCtlLogRotate) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
