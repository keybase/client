// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

import (
	"fmt"
	"os"
	"path/filepath"

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
			cl.SetLogForward(libcmdline.LogForwardNone)
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
	fmt.Println("no fork, entered Run")
	fmt.Printf("g looks like this: %+v\n", s.G())
	mctx := libkb.NewMetaContextTODO(s.G())
	g := mctx.G()

	configCli, err := GetConfigClient(mctx.G())
	if err != nil {
		return err
	}
	config, err := configCli.GetConfig(context.TODO(), 0)
	if err != nil {
		return err
	}
	fmt.Printf("config looks like this: %+v\n", config)

	switch config.ForkType {
	case keybase1.ForkType_WATCHDOG:
		g.Log.Info("service is currently running under the watchdog, so maybe run `keybase ctl stop` first and then try again")
	case keybase1.ForkType_AUTO:
		pid := os.Getpid()
		// maybe make this a debug log instead of info
		g.Log.Info("currently running fork type is %v at PID %d", config.ForkType, pid)

		keybaseBinPath, err := install.BinPath()
		if err != nil {
			return err
		}
		installDir := filepath.Dir(keybaseBinPath)
		watchdogLogPath := filepath.Join(installDir, "watchdog.")
		fullCommand := []string{
			"cmd.exe", "/C", "start", "/b", // tell the OS to start this
			filepath.Join(installDir, "keybaserq.exe"),
			keybaseBinPath,
			"--log-format=file",
			fmt.Sprintf("--log-prefix=\"%s\"", watchdogLogPath),
			"ctl",
			"watchdog2",
		}
		cmd, args := fullCommand[0], fullCommand[1:]
		fmt.Printf("calling %v with %v", cmd, args)
		pid, err = libcmdline.SpawnDetachedProcess(cmd, args, g.Log)
		if err != nil {
			return err
		}
		// maybe make this a debug log instead of info
		g.Log.Info("spawned a new watchdog at PID: %d", pid)

		mctx.Info("now kill the currently running the keybase service")
		cli, err := GetCtlClient(mctx.G())
		if err != nil {
			mctx.Error("failed to get ctl client for shutdown: %s", err)
			return err
		}
		return cli.StopService(mctx.Ctx(), keybase1.StopServiceArg{ExitCode: keybase1.ExitCode_OK})
	default:
		fmt.Println("fork type is", config.ForkType)
	}

	return nil
}

func (s *CmdCtlStart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
