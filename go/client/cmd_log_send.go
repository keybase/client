// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bufio"
	"encoding/json"
	"os"
	"strings"

	"github.com/rogpeppe/rog-go/reverse"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdLogSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "send",
		Usage: "Send recent debug logs to keybase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdLogSend{Contextified: libkb.NewContextified(g)}, "send", c)
		},
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:  "n",
				Usage: "Number of lines in each log file",
			},
		},
	}
}

type CmdLogSend struct {
	libkb.Contextified
	numLines int
}

func (c *CmdLogSend) Run() error {

	// use status command to get status:
	statusCmd := &CmdStatus{Contextified: libkb.NewContextified(c.G())}
	status, err := statusCmd.load()
	if err != nil {
		return err
	}
	statusJSON, err := json.Marshal(status)
	if err != nil {
		return err
	}
	c.G().Log.Debug("status json: %s", statusJSON)

	kbfsLog, err := tail(status.KBFS.Log, c.numLines)
	if err != nil {
		return err
	}

	svcLog, err := tail(status.Service.Log, c.numLines)
	if err != nil {
		return err
	}

	return nil
}

func tail(filename string, numLines int) (string, error) {
	f, err := os.Open(filename)
	if err != nil {
		return "", err
	}
	b := reverse.NewScanner(f)
	b.Split(bufio.ScanLines)

	var lines []string
	for b.Scan() {
		lines = append(lines, b.Text())
		if len(lines) == numLines {
			break
		}
	}

	return strings.Join(lines, "\n"), nil
}

func (c *CmdLogSend) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("log send")
	}
	c.numLines = ctx.Int("n")
	if c.numLines < 1 {
		c.numLines = 10000
	}
	return nil
}

func (c *CmdLogSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
