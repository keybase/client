// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

import (
	"fmt"
	"os/exec"
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

func (s *CmdCtlStart) serviceAlreadyRunningUnderWatchdog(g *libkb.GlobalContext) bool {
	configCli, err := GetConfigClient(g)
	if err != nil {
		fmt.Printf("error in GetConfigClient (catch this specifically?): %+v\n", err)
		// probably right here we can say the service isn't running and needs to be started
		return false
	}
	config, err := configCli.GetConfig(context.TODO(), 0)
	if err != nil {
		fmt.Printf("error in configCli.GetConfig: %+v\n", err)
		return false
	}
	fmt.Printf("config looks like this: %+v\n", config)
	if config.ForkType == keybase1.ForkType_WATCHDOG {
		return true
	}
	return false
}

func (s *CmdCtlStart) Run() (err error) {
	fmt.Printf("entered Run, g looks like this: %+v\n", s.G())
	// with no running server, g.bindFile and g.dialFiles both have the keybased.sock
	mctx := libkb.NewMetaContextTODO(s.G())
	g := mctx.G()

	if s.serviceAlreadyRunningUnderWatchdog(g) {
		g.Log.Info("service is currently running under the watchdog, so maybe run `keybase ctl stop` first and then try again")
		return nil
	}

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
	arg0, err := exec.LookPath(fullCommand[0])
	if err != nil {
		fmt.Printf("error exec.LookPath of the first element: %+v, %+v\n", arg0, err)
		return err
	}

	fmt.Printf("calling %v %v\n", arg0, fullCommand[1:])
	cmd := exec.Command(arg0, fullCommand[1:]...)
	fmt.Printf("cmd: %+v\n", cmd)
	if err := cmd.Run(); err != nil {
		fmt.Printf("error starting the command: %+v\n", err)
	}
	fmt.Println("the command has finished running. what does that actually mean?")
	return nil
}

func (s *CmdCtlStart) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
