// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-updater/watchdog"
)

// CmdWatchdog defines watchdog command
type CmdWatchdog struct {
	libkb.Contextified
}

// ParseArgv is args for the watchdog command
func (c *CmdWatchdog) ParseArgv(ctx *cli.Context) error {
	return nil
}

// Run watchdog
func (c *CmdWatchdog) Run() error {
	env := c.G().Env
	runMode := env.GetRunMode()
	if runMode != libkb.ProductionRunMode {
		return fmt.Errorf("Watchdog is only supported in production")
	}

	// Service
	keybasePath, err := install.BinPath()
	if err != nil {
		return err
	}
	serviceLogPath := filepath.Join(env.GetLogDir(), libkb.ServiceLogFileName)
	serviceProgram := watchdog.Program{
		Path: keybasePath,
		Args: []string{
			"-d",
			"--log-file=" + serviceLogPath,
			"service"},
	}

	// KBFS
	kbfsPath, err := install.KBFSBinPath(runMode, "")
	if err != nil {
		return err
	}
	mountDir, err := env.GetMountDir()
	if err != nil {
		return err
	}
	kbfsProgram := watchdog.Program{
		Path: kbfsPath,
		Args: []string{
			"-debug",
			"-log-to-file",
			mountDir,
		},
	}

	// Updater
	updaterPath, err := install.UpdaterBinPath()
	if err != nil {
		return err
	}
	updaterProgram := watchdog.Program{
		Path: updaterPath,
		Args: []string{
			"-path-to-keybase=" + keybasePath,
		},
	}

	// Start and monitor all the programs
	programs := []watchdog.Program{
		serviceProgram,
		kbfsProgram,
		updaterProgram,
	}
	if err := watchdog.Watch(programs, 10*time.Second, c); err != nil {
		return err
	}

	for {
		time.Sleep(time.Hour)
	}
}

// NewCmdWatchdog constructs watchdog command
func NewCmdWatchdog(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "watchdog",
		Usage: "Start and monitor background services",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdWatchdog{Contextified: libkb.NewContextified(g)}, "watchdog", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

// GetUsage returns library usage for this command
func (c *CmdWatchdog) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

// Debugf (for watchdog.Log interface)
func (c *CmdWatchdog) Debugf(s string, args ...interface{}) {
	c.G().Log.Debug(s, args...)
}

// Infof (for watchdog.Log interface)
func (c *CmdWatchdog) Infof(s string, args ...interface{}) {
	c.G().Log.Info(s, args...)
}

// Warningf (for watchdog Log interface)
func (c *CmdWatchdog) Warningf(s string, args ...interface{}) {
	c.G().Log.Warning(s, args...)
}

// Errorf (for watchdog Log interface)
func (c *CmdWatchdog) Errorf(s string, args ...interface{}) {
	c.G().Log.Errorf(s, args...)
}
