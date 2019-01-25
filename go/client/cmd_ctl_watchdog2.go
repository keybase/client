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

// CmdWatchdog2 defines watchdog command
type CmdWatchdog2 struct {
	libkb.Contextified
}

// ParseArgv is args for the watchdog command
func (c *CmdWatchdog2) ParseArgv(ctx *cli.Context) error {
	return nil
}

// Run watchdog
func (c *CmdWatchdog2) Run() error {
	env, log := c.G().Env, c.G().Log
	log.Info("Starting watchdog")
	runMode := env.GetRunMode()
	if runMode != libkb.ProductionRunMode {
		return fmt.Errorf("Watchdog is only supported in production")
	}
	// Don't run updater on linux
	excludeUpdater := runtime.GOOS == "linux"

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
		ExitOn: watchdog.ExitOnSuccess,
	}
	if runtime.GOOS == "windows" {
		serviceProgram.ExitOn = watchdog.ExitAllOnSuccess
	}
	programs = append(programs, serviceProgram)

	// KBFS
	kbfsPath, err := install.KBFSBinPath(runMode, "")
	if err != nil {
		return err
	}

	var mountDirArg string
	if runtime.GOOS == "windows" {
		mountDirArg = "-mount-from-service"
	} else {
		mountDirArg, err = env.GetMountDir()
		if err != nil {
			return err
		}
	}
	kbfsProgram := watchdog.Program{
		Path: kbfsPath,
		Args: []string{
			"-debug",
			"-log-to-file",
			mountDirArg,
		},
		ExitOn: watchdog.ExitOnSuccess,
	}
	programs = append(programs, kbfsProgram)

	// Updater
	if !excludeUpdater {
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
		}
		programs = append(programs, updaterProgram)
	}

	go c.pruneWatchdogLogs()

	// Start and monitor all the programs
	if err := watchdog.Watch(programs, 10*time.Second, c.G().GetLogf()); err != nil {
		return err
	}

	// Wait forever (watchdog watches programs in separate goroutines)
	select {}
}

// NewCmdWatchdog2 constructs watchdog command
func NewCmdWatchdog2(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "watchdog2",
		Usage: "Start and monitor background services",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdWatchdog2{Contextified: libkb.NewContextified(g)}, "watchdog2", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

// GetUsage returns library usage for this command
func (c *CmdWatchdog2) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

// Debugf (for watchdog.Log interface)
func (c *CmdWatchdog2) Debugf(s string, args ...interface{}) {
	c.G().Log.Debug(s, args...)
}

// Infof (for watchdog.Log interface)
func (c *CmdWatchdog2) Infof(s string, args ...interface{}) {
	c.G().Log.Info(s, args...)
}

// Warningf (for watchdog Log interface)
func (c *CmdWatchdog2) Warningf(s string, args ...interface{}) {
	c.G().Log.Warning(s, args...)
}

// Errorf (for watchdog Log interface)
func (c *CmdWatchdog2) Errorf(s string, args ...interface{}) {
	c.G().Log.Errorf(s, args...)
}

func (c *CmdWatchdog2) pruneWatchdogLogs() {
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
