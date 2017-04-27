// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// NewCmdUpdate are commands for supporting the updater
func NewCmdUpdate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "update",
		Usage:        "The updater",
		ArgumentHelp: "[arguments...]",
		HideHelp:     true,
		Subcommands: []cli.Command{
			newCmdUpdateCheck(cl, g), // Deprecated
			newCmdUpdateCheckInUse(cl, g),
			newCmdUpdateNotify(cl, g),
		},
	}
}

func newCmdUpdateCheck(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "check",
		Usage: "Check for update",
		Action: func(c *cli.Context) {
			if libkb.IsBrewBuild {
				g.Log.Errorf("\nTo update, run:\n\n\tbrew upgrade keybase")
				return
			}

			updaterPath, err := install.UpdaterBinPath()
			if err != nil {
				g.Log.Errorf("Error finding updater path: %s", err)
				return
			}
			g.Log.Errorf("\nTo update, you can run:\n\n\t%s check", updaterPath)
		},
	}
}

// newCmdUpdateCheckInUse is called by updater to see if Keybase is currently in use
func newCmdUpdateCheckInUse(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "check-in-use",
		ArgumentHelp: "",
		Usage:        "Check if we are in use (safe for restart)",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(newCmdUpdateCheckInUseRunner(g), "check-in-use", c)
		},
	}
}

type cmdUpdateCheckInUse struct {
	libkb.Contextified
}

func newCmdUpdateCheckInUseRunner(g *libkb.GlobalContext) *cmdUpdateCheckInUse {
	return &cmdUpdateCheckInUse{
		Contextified: libkb.NewContextified(g),
	}
}

func (v *cmdUpdateCheckInUse) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}

func (v *cmdUpdateCheckInUse) ParseArgv(ctx *cli.Context) error {
	return nil
}

type checkInUseResult struct {
	InUse bool `json:"in_use"`
}

func (v *cmdUpdateCheckInUse) Run() error {
	mountDir, err := v.G().Env.GetMountDir()
	if err != nil {
		return err
	}
	inUse := install.IsInUse(mountDir, G.Log)
	result := checkInUseResult{InUse: inUse}
	out, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stdout, "%s\n", out)
	return nil
}

func newCmdUpdateNotify(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "notify",
		ArgumentHelp: "<event>",
		Usage:        "Notify the service about an update event",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "Force action",
			},
		},
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(newCmdUpdateNotifyRunner(g), "notify", c)
		},
	}
}

type cmdUpdateNotify struct {
	libkb.Contextified
	force bool
	event string
}

func newCmdUpdateNotifyRunner(g *libkb.GlobalContext) *cmdUpdateNotify {
	return &cmdUpdateNotify{
		Contextified: libkb.NewContextified(g),
	}
}

func (v *cmdUpdateNotify) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}

func (v *cmdUpdateNotify) ParseArgv(ctx *cli.Context) error {
	v.force = ctx.Bool("force")
	v.event = ctx.Args().First()
	if v.event == "" {
		return fmt.Errorf("No event specified")
	}
	return nil
}

func (v *cmdUpdateNotify) Run() error {
	v.G().Log.Debug("Received event: %s", v.event)
	switch v.event {
	case "after-apply":
		// Deprecated (no longer called by go-updater)
		return nil
	default:
		return fmt.Errorf("Unrecognized event: %s", v.event)
	}
}
