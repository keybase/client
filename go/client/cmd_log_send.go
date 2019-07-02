// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"time"

	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/status"
	"golang.org/x/net/context"
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
			cli.StringFlag{
				Name:  "feedback",
				Usage: "Attach a feedback message to a log send",
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
		if c.feedback == "" {
			if err := c.getFeedback(); err != nil {
				return err
			}
		}
	}

	// if this fails for any reason, it is not a fatal error.
	// highly possible that the service isn't running and thus
	// can't get status.
	c.G().Log.Debug("attempting retrieval of keybase service status")
	var statusJSON string
	statusCmd := &CmdStatus{Contextified: libkb.NewContextified(c.G())}
	fstatus, err := statusCmd.load()
	if err != nil {
		c.G().Log.Info("ignoring error getting keybase status: %s", err)
		// pid will be -1 if not found here
		pid, err2 := getPid(c.G())
		if err2 == nil {
			// Look for the process. os.FindProcess()
			// only fails if on Windows and no process is found.
			_, err2 := os.FindProcess(pid)
			if err2 != nil {
				pid = 0
			}
		}
		statusJSON = fmt.Sprintf("{\"pid\":%d, \"Error\":%q}", pid, err)
	} else {
		json, err := json.Marshal(fstatus)
		if err != nil {
			c.G().Log.Info("ignoring status json marshal error: %s", err)
			statusJSON = c.errJSON(err)
		} else {
			statusJSON = string(json)
		}
	}

	if err = c.pokeUI(); err != nil {
		c.G().Log.Info("ignoring UI logs: %s", err)
	}

	logSendContext := status.NewLogSendContext(c.G(), fstatus, statusJSON, c.feedback)
	id, err := logSendContext.LogSend(true /* sendLogs */, c.numBytes, false /* mergeExtendedStatus */)
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
	if err = cli.PrepareLogsend(context.Background()); err != nil {
		return err
	}
	// Give the GUI a moment to get its logs in order
	time.Sleep(time.Second)
	return nil
}

func (c *CmdLogSend) confirm() error {
	ui := c.G().UI.GetTerminalUI()
	ui.Printf("This command will send recent keybase log entries to keybase.io\n")
	ui.Printf("for debugging purposes only.\n\n")
	ui.Printf("These logs don’t include your private keys, encrypted data or file names,\n")
	ui.Printf("but they will include metadata Keybase normally can't read\n")
	ui.Printf("(like file sizes and git repo names), for debugging purposes.\n\n")
	return ui.PromptForConfirmation("Continue sending logs to keybase.io?")
}

func (c *CmdLogSend) getFeedback() (err error) {
	ui := c.G().UI.GetTerminalUI()
	for err == nil {
		var in string
		if c.feedback == "" {
			in, err = ui.Prompt(0, "Enter feedback (or <Enter> to send): ")
		} else {
			in, err = ui.Prompt(0, "More feedback (or press <Enter> when done): ")
		}
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

func (c *CmdLogSend) outputInstructions(id keybase1.LogSendID) {
	ui := c.G().UI.GetTerminalUI()

	ui.Printf("\n\n------------\n")
	ui.Printf("Success! Your log ID is:\n\n")
	ui.Printf("  %s\n\n", id)
	ui.Printf("Here's a URL to submit new bug reports containing this ID:\n\n")
	ui.Output("  https://github.com/keybase/client/issues/new?body=[write%20something%20useful%20and%20descriptive%20here]%0A%0Amy%20log%20id:%20" + string(id))
	ui.Printf("\n\nThanks!\n")
	ui.Printf("------------\n\n")
}

func (c *CmdLogSend) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("log send")
	}
	c.noConfirm = ctx.Bool("no-confirm")
	c.numBytes = ctx.Int("n")
	c.feedback = ctx.String("feedback")
	return nil
}

func (c *CmdLogSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdLogSend) errJSON(err error) string {
	return fmt.Sprintf("{\"Error\":%q}", err)
}
