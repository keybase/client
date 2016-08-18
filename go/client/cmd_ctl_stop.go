// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"os"
)

func NewCmdCtlStop(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "stop",
		Usage: "Stop the background keybase service",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "kill-kbfs",
				Usage: "Shut down KBFS as well",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(newCmdCtlStop(g), "stop", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

func newCmdCtlStop(g *libkb.GlobalContext) *CmdCtlStop {
	return &CmdCtlStop{
		Contextified: libkb.NewContextified(g),
	}
}

type CmdCtlStop struct {
	libkb.Contextified
	killKBFS bool
}

func (s *CmdCtlStop) ParseArgv(ctx *cli.Context) error {
	s.killKBFS = ctx.Bool("kill-kbfs")
	return nil
}

func (s *CmdCtlStop) Run() (err error) {
	if s.killKBFS {
		s.doKillKBFS()
	}
	return CtlServiceStop(s.G())

}

func (s *CmdCtlStop) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (s *CmdCtlStop) doKillKBFS() {
	mountDir, err := s.G().Env.GetMountDir()
	if err != nil {
		s.G().Log.Errorf("KillKBFS: Error in GetMountDir: %s", err.Error())
	} else {
		// open special "file". Errors not relevant.
		s.G().Log.Debug("KillKBFS: opening .kbfs_unmount")
		os.Create(mountDir + ".kbfs_unmount")
	}
}
