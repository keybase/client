// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"path/filepath"

	"os"

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
	// So far, install logs are Windows only
	if logs.Install != "" {
		defer os.Remove(logs.Install)
	}

	logSendContext := libkb.LogSendContext{
		Contextified: libkb.NewContextified(c.G()),
		Logs:         logs,
	}

	id, err := logSendContext.LogSend(statusJSON, c.numLines)
	if err != nil {
		return err
	}

	c.outputInstructions(id)
	return nil
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

func (c *CmdLogSend) logFiles(status *fstatus) libkb.Logs {
	logDir := c.G().Env.GetLogDir()
	installLogPath, err := GetInstallLogPath()
	if err != nil {
		c.G().Log.Errorf("Error in GetInstallLogPath: %s", err)
		installLogPath = ""
	}
	if status != nil {
		return libkb.Logs{
			Desktop: status.Desktop.Log,
			Kbfs:    status.KBFS.Log,
			Service: status.Service.Log,
			Updater: status.Updater.Log,
			Start:   status.Start.Log,
			Install: installLogPath,
		}
	}

	return libkb.Logs{
		Desktop: filepath.Join(logDir, libkb.DesktopLogFileName),
		Kbfs:    filepath.Join(logDir, libkb.KBFSLogFileName),
		Service: filepath.Join(logDir, libkb.ServiceLogFileName),
		Updater: filepath.Join(logDir, libkb.UpdaterLogFileName),
		Start:   filepath.Join(logDir, libkb.StartLogFileName),
		Install: installLogPath,
	}
}

func (c *CmdLogSend) errJSON(err error) string {
	return fmt.Sprintf("{\"Error\":%q}", err)
}
