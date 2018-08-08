// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"text/tabwriter"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CmdAccountLockdown struct {
	libkb.Contextified
	SetLockdownMode *bool
	History         bool
}

func NewCmdAccountLockdown(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdAccountLockdown{
		Contextified: libkb.NewContextified(g),
	}
	flags := []cli.Flag{
		cli.BoolFlag{
			Name:  "set",
			Usage: "Change account lockdown mode.",
		},
		cli.BoolFlag{
			Name:  "history",
			Usage: "Print history of lockdown mode changes.",
		},
	}
	return cli.Command{
		Name:  "lockdown",
		Usage: "Manage lockdown mode",
		Flags: flags,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "lockdown", c)
		},
	}
}

func (c *CmdAccountLockdown) ParseArgv(ctx *cli.Context) error {
	if ctx.IsSet("set") {
		val, err := ctx.BoolStrict("set")
		if err != nil {
			return err
		}
		c.SetLockdownMode = &val
	} else {
		c.History = ctx.Bool("history")
	}
	return nil
}

func (c *CmdAccountLockdown) Run() error {
	// protocols := []rpc.Protocol{
	//     NewSecretUIProtocol(c.G()),
	// }
	// if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
	//     return err
	// }
	cli, err := GetAccountClient(c.G())
	if err != nil {
		return err
	}

	dui := c.G().UI.GetTerminalUI()

	enabledGreen := func() string { return ColorString(c.G(), "green", "enabled") }
	disabledYellow := func() string { return ColorString(c.G(), "yellow", "disabled") }

	if c.SetLockdownMode != nil {
		res, err := cli.GetLockdownMode(context.Background(), 0)
		if err != nil {
			return err
		}
		if res.Status == *c.SetLockdownMode {
			if res.Status {
				dui.PrintfUnescaped("Lockdown mode is already %s. Nothing to do.\n", enabledGreen())
			} else {
				dui.Printf("Lockdown mode is already %s. Nothing to do.\n", disabledYellow())
			}
			return nil
		}
		err = cli.SetLockdownMode(context.Background(), keybase1.SetLockdownModeArg{
			Enabled: *c.SetLockdownMode,
		})
		if err != nil {
			return err
		}
	}

	res, err := cli.GetLockdownMode(context.Background(), 0)
	if err != nil {
		return err
	}
	dui.Printf("Lockdown mode is: ")
	if res.Status {
		dui.PrintfUnescaped("%s\n", ColorString(c.G(), "green", enabledGreen()))
	} else {
		dui.PrintfUnescaped("%s\n", ColorString(c.G(), "yellow", disabledYellow()))
	}

	if c.History {
		tabw := new(tabwriter.Writer)
		tabw.Init(dui.OutputWriter(), 0, 8, 4, ' ', 0)
		fmt.Fprintf(tabw, "Changed to:\tChange time:\tDevice:\n")
		for _, v := range res.History {
			var status string
			if v.Status {
				status = "enabled"
			} else {
				status = "disabled"
			}
			fmt.Fprintf(tabw, "%s\t%s\t%s (%s)\n", status, keybase1.FormatTime(v.CreationTime), v.DeviceName, v.DeviceID)
		}
		tabw.Flush()
	}

	return nil
}

func (c *CmdAccountLockdown) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
