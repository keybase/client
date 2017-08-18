// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

import (
	"os"
	"path/filepath"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
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
	cli, err := GetKBFSMountClient(s.G())
	if err != nil {
		s.G().Log.Errorf("KillKBFS: Error in GetKBFSMountClient: %s", err.Error())
	}

	mountDir, err := cli.GetCurrentMountDir(context.TODO())
	if err != nil {
		s.G().Log.Errorf("KillKBFS: Error in GetCurrentMountDir: %s", err.Error())
	} else {
		// open special "file". Errors not relevant.
		s.G().Log.Debug("KillKBFS: opening .kbfs_unmount")
		os.Open(filepath.Join(mountDir, "\\.kbfs_unmount"))
		libkb.ChangeMountIcon(mountDir, "")
	}
}
