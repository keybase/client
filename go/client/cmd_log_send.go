// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"os"
	"path/filepath"
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

type logs struct {
	desktop string
	kbfs    string
	service string
	updater string
	start   string
}

func NewCmdLogSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "send",
		Usage: "Send recent debug logs to keybase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdLogSend{Contextified: libkb.NewContextified(g)}, "send", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
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

	// if this fails for any reason, it is not a fatal error.
	// highly possible that the service isn't running and thus
	// can't get status.
	c.G().Log.Debug("attempting retrieval of keybase service status")
	var statusJSON string
	statusCmd := &CmdStatus{Contextified: libkb.NewContextified(c.G())}
	status, err := statusCmd.load()
	if err != nil {
		c.G().Log.Info("ignoring error getting keybase status: %s", err)
		statusJSON = c.errJSON(err)
	} else {
		json, err := json.Marshal(status)
		if err != nil {
			c.G().Log.Info("ignoring status json marshal error: %s", err)
			statusJSON = c.errJSON(err)
		} else {
			statusJSON = string(json)
		}
	}

	logs := c.logFiles(status)

	c.G().Log.Debug("tailing kbfs log %q", logs.kbfs)
	kbfsLog := c.tail(logs.kbfs, c.numLines)

	c.G().Log.Debug("tailing service log %q", logs.service)
	svcLog := c.tail(logs.service, c.numLines)

	c.G().Log.Debug("tailing desktop log %q", logs.desktop)
	desktopLog := c.tail(logs.desktop, c.numLines)

	c.G().Log.Debug("tailing updater log %q", logs.updater)
	updaterLog := c.tail(logs.updater, c.numLines)

	c.G().Log.Debug("tailing start log %q", logs.start)
	startLog := c.tail(logs.start, c.numLines)

	return c.post(statusJSON, kbfsLog, svcLog, desktopLog, updaterLog, startLog)
}

func (c *CmdLogSend) confirm() error {
	ui := c.G().UI.GetTerminalUI()
	ui.Printf("This command will send recent keybase log entries to keybase.io\n")
	ui.Printf("for debugging purposes only.\n\n")
	ui.Printf("These logs don’t include your private keys or encrypted data,\n")
	ui.Printf("but they will include filenames and other metadata keybase normally\n")
	ui.Printf("can’t read, for debugging purposes.\n\n")
	return ui.PromptForConfirmation("Continue sending logs to keybase.io?")
}

func (c *CmdLogSend) post(status, kbfsLog, svcLog, desktopLog, updaterLog, startLog string) error {
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
	if err := addFile(mpart, "updater_log_gz", "updater_log.gz", updaterLog); err != nil {
		return err
	}
	if err := addFile(mpart, "gui_log_gz", "gui_log.gz", desktopLog); err != nil {
		return err
	}
	if err := addFile(mpart, "start_log_gz", "start_log.gz", startLog); err != nil {
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

	ui.Printf("\n\n------------\n")
	ui.Printf("Success! Your log ID is:\n\n")
	ui.Printf("  %s\n\n", id)
	ui.Printf("Here's a URL to submit new bug reports containing this ID:\n\n")
	ui.Output("  https://github.com/keybase/client/issues/new?body=[write%20something%20useful%20and%20descriptive%20here]%0A%0Amy%20log%20id:%20" + id)
	ui.Printf("\n\nThanks!\n")
	ui.Printf("------------\n\n")
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

func (c *CmdLogSend) logFiles(status *fstatus) logs {
	logDir := c.G().Env.GetLogDir()
	if status != nil {
		return logs{
			desktop: status.Desktop.Log,
			kbfs:    status.KBFS.Log,
			service: status.Service.Log,
			updater: status.Updater.Log,
			start:   status.Start.Log,
		}
	}

	return logs{
		desktop: filepath.Join(logDir, libkb.DesktopLogFileName),
		kbfs:    filepath.Join(logDir, libkb.KBFSLogFileName),
		service: filepath.Join(logDir, libkb.ServiceLogFileName),
		updater: filepath.Join(logDir, libkb.UpdaterLogFileName),
		start:   filepath.Join(logDir, libkb.StartLogFileName),
	}
}

func (c *CmdLogSend) errJSON(err error) string {
	return fmt.Sprintf("{\"Error\":%q}", err)
}
