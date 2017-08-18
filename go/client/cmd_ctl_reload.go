// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

func NewCmdCtlReload(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "reload",
		Usage: "Reload config file",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlReload{libkb.NewContextified(g)}, "reload", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlReload struct {
	libkb.Contextified
}

func (s *CmdCtlReload) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlReload) Run() (err error) {
	cli, err := GetCtlClient(s.G())
	if err != nil {
		return err
	}
	return cli.Reload(context.TODO(), 0)
}

func (s *CmdCtlReload) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
