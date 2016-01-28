// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bufio"
	"bytes"
	"compress/gzip"
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

	c.G().Log.Debug("getting keybase status")
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

	c.G().Log.Debug("tailing kbfs log %q", status.KBFS.Log)
	kbfsLog, err := tail(status.KBFS.Log, c.numLines)
	if err != nil {
		return err
	}

	c.G().Log.Debug("tailing service log %q", status.Service.Log)
	svcLog, err := tail(status.Service.Log, c.numLines)
	if err != nil {
		return err
	}

	return c.post(string(statusJSON), kbfsLog, svcLog)
}

func (c *CmdLogSend) post(status, kbfsLog, svcLog string) error {
	c.G().Log.Debug("sending status + logs to keybase")
	arg := libkb.APIArg{
		Endpoint: "logdump/send",
		Args: libkb.HTTPArgs{
			"status_gz":      libkb.B64Arg(compress(status)),
			"kbfs_log_gz":    libkb.B64Arg(compress(kbfsLog)),
			"keybase_log_gz": libkb.B64Arg(compress(svcLog)),
		},
	}

	resp, err := c.G().API.Post(arg)
	if err != nil {
		c.G().Log.Debug("post error: %s", err)
		return err
	}

	id, err := resp.Body.AtKey("id").GetString()
	if err != nil {
		return err
	}

	c.G().Log.Info("logs sent, dump id = %q", id)
	return nil
}

func compress(s string) []byte {
	var buf bytes.Buffer
	zip := gzip.NewWriter(&buf)
	zip.Write([]byte(s))
	zip.Close()
	return buf.Bytes()
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
