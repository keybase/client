// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"os"
	"syscall"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const numRestartsDefault = 10

type CmdWatchdog struct {
	libkb.Contextified
	restarts int
}

func (c *CmdWatchdog) ParseArgv(ctx *cli.Context) error {
	c.restarts = ctx.Int("num-restarts")
	if c.restarts == 0 {
		c.restarts = numRestartsDefault
	}

	return nil
}

func (c *CmdWatchdog) checkAlreadyRunning() bool {
	s, err := libkb.NewSocket(c.G())
	if err != nil {
		return false
	}
	conn, err := s.DialSocket()
	if conn != nil {
		conn.Close()
		return true
	}
	return false
}

func (c *CmdWatchdog) Run() (err error) {
	// Start + watch over the running service
	// until it goes away, which will mean one of:
	// - crash
	// - system shutdown
	// - uninstall
	// - legitimate stoppage (ctl stop)
	// - legitimate stoppage (ctl restart)

	// Testing loop:
	// - start service, noting pid
	// - Do a wait operation on the process
	// - On return, check exit code of process
	//    - No error: legitimate shutdown, we exit.
	//    - Failure exit code: restart service
	//    - Special restart command exit code: restart without counting
	//
	// Note that we give up after c.restarts consecutive crashes.
	// Loop one extra time for initial spawn.
	for restartcount := 0; restartcount <= c.restarts; restartcount++ {
		// Blocking wait on service. First, there has to be a pid
		// file, because this is a forking command.

		var pid int
		// restart server case
		if pid, err = spawnServer(c.G(), c.G().Env.GetCommandLine(), keybase1.ForkType_WATCHDOG); err != nil {
			return err
		}

		p, err := os.FindProcess(pid)
		if err != nil {
			c.G().Log.Warning("Watchdog can't find %d, exiting", pid)
			return err
		}

		pstate, err := p.Wait()

		if err != nil || pstate.Exited() == false {
			c.G().Log.Warning("Watchdog ends service wait with no error or exit")
			return err
		}

		if pstate.Success() {
			// apparently legitimate shutdown
			return nil
		}

		if c.checkAlreadyRunning() {
			return fmt.Errorf("Watchdog Service already running before watchdog - quitting.")
		}

		status := pstate.Sys().(syscall.WaitStatus)
		c.G().Log.Warning("watched service crash with status %v, count %d", status, restartcount)
		if status.ExitStatus() == int(keybase1.ExitCode_RESTART) {
			// Some third process issued a restart command.
			// This doesn't count against our limit
			restartcount--
		}
	}

	return fmt.Errorf("Watchdog observed %d crashes in a row. NOT reforking.", c.restarts)
}

func NewCmdWatchdog(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "watchdog",
		Usage: "Start, watch and prop up the background service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdWatchdog{Contextified: libkb.NewContextified(g)}, "watchdog", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:  "n, num-restarts",
				Value: numRestartsDefault,
				Usage: "specify the number of retries before giving up",
			},
		},
	}
}

func (c *CmdWatchdog) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
