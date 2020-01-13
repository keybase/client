// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// NewCmdCtlStart constructs ctl start command
func NewCmdCtlStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "start",
		Usage: "Start the background keybase services",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCtlStart{libkb.NewContextified(g)}, "start", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetNoStandalone()
		},
	}
}

type CmdCtlStart struct {
	libkb.Contextified
}

func (s *CmdCtlStart) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdCtlStart) Run() (err error) {
	g := s.G()
	configCli, err := GetConfigClient(g)
	if err != nil {
		return err
	}
	config, err := configCli.GetConfig(context.TODO(), 0)
	if err != nil {
		return err
	}

	switch config.ForkType {
	case keybase1.ForkType_WATCHDOG:
		g.Log.Info("service is currently running under the watchdog, so maybe run `keybase ctl stop` first and then try again")
	default:
		pid := os.Getpid()
		// maybe make this a debug log instead of info
		g.Log.Info("currently running fork type is %v at PID %d", config.ForkType, pid)

		keybaseBinPath, err := install.BinPath()
		if err != nil {
			return err
		}
		installDir := filepath.Dir(keybaseBinPath)
		cmd := filepath.Join(installDir, "keybaserq.exe")
		watchdogLogPath := filepath.Join(installDir, "watchdog.")
		args := []string{
			keybaseBinPath,
			"--log-format=file",
			fmt.Sprintf("--log-prefix=\"%s\"", watchdogLogPath),
			"ctl",
			"watchdog2",
		}

		pid, err = libcmdline.SpawnDetachedProcess(cmd, args, g.Log)
		if err != nil {
			return err
		}
		// maybe make this a debug log instead of info
		g.Log.Info("spawned a new watchdog at PID: %d", pid)

		myPid := os.Getpid()
		timer := time.NewTimer(60 * time.Second)
		ticker := time.NewTicker(1 * time.Second)
		for {
			select {
			case <-ticker.C:
				proc, err := os.FindProcess(pid)
				g.Log.Info("status of the spawned watchdog: %+v, %+v", proc, err)
				proc, err = os.FindProcess(myPid)
				g.Log.Info("status of myself: %+v, %+v", proc, err)
			case <-timer.C:
				g.Log.Info("time's up. hopefully you know what you were looking for")
				break
			}
		}
	}

	return nil
}

func (s *CmdCtlStart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
