// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bufio"
	"errors"
	"fmt"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/natefinch/npipe"
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

func (c *CmdWatchdog) Run() (err error) {
	// Watch over the running service
	// until it goes away, which will mean one of:
	// - crash
	// - system shutdown
	// - uninstall
	// - legitimate stoppage (ctl stop)

	// Testing loop:
	// - dial pipe. Pipe up equals service up.
	// - Do a blocking read. Server won't be writing anything,
	//   so this is our canary for shutdown.
	//   - If down, test existence of PidFile (maybe wait a moment).
	//      - No PidFile: normal shutdown. We stop too.
	//      - PidFile still there: crashed(?) Restart.
	//        (file should be writable in that case)
	//
	// Note that we give up after 10 consecutive crashes

	if c.G().SocketInfo == nil {
		return errors.New("Uninitialized socket")
	}
	pipeName := c.G().SocketInfo.GetFile()
	if len(pipeName) == 0 {
		return errors.New("No pipe name")
	}

	countdown := c.restarts
	for {
		conn, err := npipe.DialTimeout(pipeName, time.Second*10)
		if conn == nil {
			// no service started. exit.
			return err
		}
		for {
			answer, err := bufio.NewReader(conn).ReadString('\n')
			// We should not have received anything, this should mean
			// the pipe has been closed - but test just in case
			if len(answer) == 0 || err != nil {
				break
			}
		}

		conn.Close()

		// Give the service a second to clean up its file
		time.Sleep(time.Second * 1)

		var fn string
		if fn, err = c.G().Env.GetPidFile(); err != nil {
			return err
		}
		crashed, _ := libkb.FileExists(fn)
		if !crashed {
			// apparently legitimate shutdown
			return nil
		}
		if countdown <= 0 {
			break
		}
		// restart server case (is this the right command line?)
		if err = ForkServer(c.G().Env.GetCommandLine(), c.G()); err != nil {
			return err
		}
		countdown--
	}

	return fmt.Errorf("Watchdog observed %d crashes in a row. NOT reforking.", c.restarts)
}

func NewCmdWatchdog(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "watchdog",
		Usage: "Start, watch and prop up the background service",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdWatchdog{Contextified: libkb.NewContextified(g)}, "watchdog", c)
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
