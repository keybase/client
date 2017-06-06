// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"path/filepath"

	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

const (
	defaultBytes = 1024 * 1024 * 16
	maxBytes     = 1024 * 1024 * 128
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
				Usage: "Number of bytes in each log file to read",
			},
			cli.BoolFlag{
				Name:  "no-confirm",
				Usage: "Send logs without confirming",
			},
		},
	}
}

type CmdLogSend struct {
	libkb.Contextified
	numBytes  int
	noConfirm bool
	feedback  string
}

func (c *CmdLogSend) Run() error {

	if !c.noConfirm {
		if err := c.confirm(); err != nil {
			return err
		}
		if err := c.getFeedback(); err != nil {
			return err
		}
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
		pid, err2 := getPid(c.G())
		if err2 != nil {
			// See if the pid file is present. os.FindProcess()
			// only fails if on Windows and no process is found.
			_, err2 := os.FindProcess(pid)
			if err2 != nil {
				statusJSON = fmt.Sprintf("{\"pid\":%d, \"Error\":%q}", pid, err)
			}
		}
	} else {
		json, err := json.Marshal(status)
		if err != nil {
			c.G().Log.Info("ignoring status json marshal error: %s", err)
			statusJSON = c.errJSON(err)
		} else {
			statusJSON = string(json)
		}
	}

	err = c.pokeUI()
	if err != nil {
		c.G().Log.Info("ignoring UI logs: %s", err)
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

	id, err := logSendContext.LogSend(statusJSON, c.feedback, true, c.numBytes)
	if err != nil {
		return err
	}

	c.outputInstructions(id)
	return nil
}

func (c *CmdLogSend) pokeUI() error {
	cli, err := GetLogsendClient(c.G())
	if err != nil {
		return err
	}
	return cli.PrepareLogsend(context.Background())
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

func (c *CmdLogSend) getFeedback() error {
	ui := c.G().UI.GetTerminalUI()
	var err error
	for err == nil {
		in, err := ui.Prompt(0, "Enter feedback (or ENTER to send): ")
		if err != nil {
			return err
		}
		if in != "" {
			c.feedback = c.feedback + in + "\n"
		} else {
			break
		}
	}
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

func (c *CmdLogSend) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("log send")
	}
	c.noConfirm = ctx.Bool("no-confirm")
	c.numBytes = ctx.Int("n")
	if c.numBytes < 1 {
		c.numBytes = defaultBytes
	} else if c.numBytes > maxBytes {
		c.numBytes = maxBytes
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
	installLogPath, err := install.InstallLogPath()
	if err != nil {
		c.G().Log.Errorf("Error (InstallLogPath): %s", err)
	}
	if status != nil {
		return libkb.Logs{
			Desktop: status.Desktop.Log,
			Kbfs:    status.KBFS.Log,
			Service: status.Service.Log,
			Updater: status.Updater.Log,
			Start:   status.Start.Log,
			Install: installLogPath,
			System:  install.SystemLogPath(),
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
