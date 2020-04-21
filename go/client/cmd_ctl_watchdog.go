// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
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
	env, log := c.G().Env, c.G().Log
	log.Info("Starting watchdog")
	runMode := env.GetRunMode()
	if runMode != libkb.ProductionRunMode {
		return fmt.Errorf("Watchdog is only supported in production")
	}
	if runtime.GOOS != "windows" {
		return fmt.Errorf("Watchdog is only supported in windows")
	}

	programs := []watchdog.Program{}

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
			"service",
			"--watchdog-forked",
		},
		// when the service exits gracefully, also exit the watchdog and any other programs it is currently watching
		ExitOn: watchdog.ExitAllOnSuccess,
		Name:   "KeybaseService",
	}
	programs = append(programs, serviceProgram)

	// KBFS
	kbfsPath, err := install.KBFSBinPath(runMode, "")
	if err != nil {
		return err
	}

	mountDirArg := "-mount-from-service"
	kbfsProgram := watchdog.Program{
		Path: kbfsPath,
		Args: []string{
			"-debug",
			"-log-to-file",
			mountDirArg,
		},
		ExitOn: watchdog.ExitOnSuccess,
		Name:   "KBFS",
	}
	programs = append(programs, kbfsProgram)

	// Updater
	updaterPath, err := install.UpdaterBinPath()
	if err != nil {
		return err
	}
	updaterProgram := watchdog.Program{
		Path: updaterPath,
		Args: []string{
			"-log-to-file",
			"-path-to-keybase=" + keybasePath,
		},
		Name: "KeybaseUpdater",
	}
	programs = append(programs, updaterProgram)

	go c.pruneWatchdogLogs()

	// Start and monitor all the programs
	if err := watchdog.Watch(programs, 10*time.Second, c.G().GetLogf()); err != nil {
		return err
	}

	// Wait forever (watchdog watches programs in separate goroutines)
	select {}
}

// NewCmdWatchdog constructs watchdog command
func NewCmdWatchdog(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "watchdog",
		// watchdog2 was renamed to watchdog, so this line is for backwards compatibility. We can eventually remove it.
		Aliases: []string{"watchdog2"},
		Usage:   "Start and monitor background services",
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

func (c *CmdWatchdog) pruneWatchdogLogs() {
	logPrefix := c.G().Env.GetLogPrefix()
	if logPrefix == "" {
		return
	}

	// Remove all but the 5 newest watchdog logs - sorting by name works because timestamp
	watchdogLogFiles, err := filepath.Glob(logPrefix + "*.log")
	if err != nil {
		return
	}
	sort.Sort(sort.Reverse(sort.StringSlice(watchdogLogFiles)))
	if len(watchdogLogFiles) <= 5 {
		return
	}
	watchdogLogFiles = watchdogLogFiles[5:]

	for _, path := range watchdogLogFiles {
		os.Remove(path)
	}
}
