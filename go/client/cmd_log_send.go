// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"mime/multipart"
	"os"
	"strings"

	"github.com/rogpeppe/rog-go/reverse"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

const (
	defaultLines = 1e5
	maxLines     = 1e6
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
	if err := c.confirm(); err != nil {
		return err
	}

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

	c.G().Log.Debug("tailing kbfs log %q", status.KBFS.Log)
	kbfsLog := c.tail(status.KBFS.Log, c.numLines)

	c.G().Log.Debug("tailing service log %q", status.Service.Log)
	svcLog := c.tail(status.Service.Log, c.numLines)

	c.G().Log.Debug("tailing desktop log %q", status.Desktop.Log)
	desktopLog := c.tail(status.Desktop.Log, c.numLines)

	return c.post(string(statusJSON), kbfsLog, svcLog, desktopLog)
}

func (c *CmdLogSend) confirm() error {
	ui := c.G().UI.GetTerminalUI()
	ui.Printf("This command will send recent keybase log entries to keybase.io\n")
	ui.Printf("for debugging purposes only.\n\n")
	ui.Printf("While we have made every attempt to keep sensitive information\n")
	ui.Printf("out of the logs, we wanted to make sure you are ok with sending\n")
	ui.Printf("your log files.\n\n")
	return ui.PromptForConfirmation("Continue sending logs to keybase.io?")
}

func (c *CmdLogSend) post(status, kbfsLog, svcLog, desktopLog string) error {
	c.G().Log.Debug("sending status + logs to keybase")

	var body bytes.Buffer
	mpart := multipart.NewWriter(&body)

	if err := addFile(mpart, "status_gz", "status.gz", status); err != nil {
		return err
	}
	if err := addFile(mpart, "kbfs_log_gz", "kbfs_log.gz", kbfsLog); err != nil {
		return err
	}
	if err := addFile(mpart, "keybase_log_gz", "keybase_log.gz", svcLog); err != nil {
		return err
	}
	if err := addFile(mpart, "gui_log_gz", "gui_log.gz", desktopLog); err != nil {
		return err
	}

	if err := mpart.Close(); err != nil {
		return err
	}

	c.G().Log.Debug("body size: %d\n", body.Len())

	arg := libkb.APIArg{
		Contextified: libkb.NewContextified(c.G()),
		Endpoint:     "logdump/send",
	}

	resp, err := c.G().API.PostRaw(arg, mpart.FormDataContentType(), &body)
	if err != nil {
		c.G().Log.Debug("post error: %s", err)
		return err
	}

	id, err := resp.Body.AtKey("logdump_id").GetString()
	if err != nil {
		return err
	}

	c.outputInstructions(id)
	return nil
}

func (c *CmdLogSend) outputInstructions(id string) {
	ui := c.G().UI.GetTerminalUI()
	ui.Printf("keybase.io received your logs successfully! Your log dump ID is:\n\n")
	ui.Printf("\t%s\n\n", id)
	ui.Printf("Here's a URL to submit a bug report containing this ID:\n\n")
	ui.Printf("\thttps://github.com/keybase/keybase-issues/issues/new?body=log+dump+id+%s\n\n", id)
	ui.Printf("Thanks!\n")
}

func addFile(mpart *multipart.Writer, param, filename, data string) error {
	if len(data) == 0 {
		return nil
	}

	part, err := mpart.CreateFormFile(param, filename)
	if err != nil {
		return err
	}
	gz := gzip.NewWriter(part)
	if _, err := gz.Write([]byte(data)); err != nil {
		return err
	}
	if err := gz.Close(); err != nil {
		return err
	}

	return nil
}

func (c *CmdLogSend) tail(filename string, numLines int) string {
	f, err := os.Open(filename)
	if err != nil {
		c.G().Log.Warning("error opening log %q: %s", filename, err)
		return ""
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

	for left, right := 0, len(lines)-1; left < right; left, right = left+1, right-1 {
		lines[left], lines[right] = lines[right], lines[left]
	}

	return strings.Join(lines, "\n")
}

func (c *CmdLogSend) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("log send")
	}
	c.numLines = ctx.Int("n")
	if c.numLines < 1 {
		c.numLines = defaultLines
	} else if c.numLines > maxLines {
		c.numLines = maxLines
	}
	return nil
}

func (c *CmdLogSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
