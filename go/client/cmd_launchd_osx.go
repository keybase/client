// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func NewCmdLaunchd(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "launchd",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdLaunchdInstall(cl, g),
			NewCmdLaunchdUninstall(cl, g),
			NewCmdLaunchdList(cl, g),
			NewCmdLaunchdStatus(cl, g),
			NewCmdLaunchdStart(cl, g),
			NewCmdLaunchdStop(cl, g),
			NewCmdLaunchdRestart(cl, g),
		},
	}
}

func NewCmdLaunchdInstall(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "install",
		ArgumentHelp: "<label> <path/to/keybase> <args>",
		Usage:        "Install a launchd service",
		Action: func(c *cli.Context) {
			// TODO: Use ChooseCommand
			args := c.Args()
			if len(args) < 1 {
				g.Log.Fatalf("No label specified.")
			}
			if len(args) < 2 {
				g.Log.Fatalf("No path to keybase executable specified.")
			}

			label := args[0]
			binPath := args[1]
			plistArgs := args[2:]
			envVars := defaultLaunchdEnvVars(g, label)

			plist := launchd.NewPlist(label, binPath, plistArgs, envVars)
			err := launchd.Install(plist, os.Stdout)
			if err != nil {
				g.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdUninstall(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "uninstall",
		ArgumentHelp: "<label>",
		Usage:        "Uninstall a keybase launchd service",
		Action: func(c *cli.Context) {
			// TODO: Use ChooseCommand
			args := c.Args()
			if len(args) < 1 {
				g.Log.Fatalf("No label specified.")
			}
			err := launchd.Uninstall(args[0], os.Stdout)
			if err != nil {
				g.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "list",
		Usage: "List keybase launchd services",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "f, format",
				Usage: "Format for output. Specify 'j' for JSON or blank for default.",
			},
		},
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdLaunchdListRunner(g), "list", c)
		},
	}
}

func NewCmdLaunchdRestart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "restart",
		ArgumentHelp: "<label>",
		Usage:        "Restart a keybase launchd service",
		Action: func(c *cli.Context) {
			// TODO: Use ChooseCommand
			args := c.Args()
			if len(args) < 1 {
				g.Log.Fatalf("No label specified.")
			}
			err := launchd.Restart(args[0], os.Stdout)
			if err != nil {
				g.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "start",
		ArgumentHelp: "<label>",
		Usage:        "Start a keybase launchd service",
		Action: func(c *cli.Context) {
			// TODO: Use ChooseCommand
			args := c.Args()
			if len(args) < 1 {
				g.Log.Fatalf("No label specified")
			}
			err := launchd.Start(args[0], os.Stdout)
			if err != nil {
				g.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdStop(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "stop",
		ArgumentHelp: "<label>",
		Usage:        "Stop a keybase launchd service",
		Action: func(c *cli.Context) {
			// TODO: Use ChooseCommand
			args := c.Args()
			if len(args) < 1 {
				g.Log.Fatalf("No label specified.")
			}
			err := launchd.Stop(args[0], os.Stdout)
			if err != nil {
				g.Log.Fatalf("%v", err)
			}
			os.Exit(0)
		},
	}
}

func NewCmdLaunchdStatus(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "status",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "b, bundle-version",
				Usage: "Bundle version",
			},
			cli.StringFlag{
				Name:  "f, format",
				Usage: "Format for output. Specify 'j' for JSON or blank for default.",
			},
		},
		ArgumentHelp: "<service-name>",
		Usage:        "Status for keybase launchd service, including for installing or updating",
		Action: func(c *cli.Context) {
			// This is to bypass the logui protocol registration in main.go which is
			// triggering a connection before our Run() is called. See that file for
			// more info.
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdLaunchdStatusRunner(g), "status", c)
		},
	}
}

type CmdLaunchdList struct {
	libkb.Contextified
	format string
}

func NewCmdLaunchdListRunner(g *libkb.GlobalContext) *CmdLaunchdList {
	return &CmdLaunchdList{
		Contextified: libkb.NewContextified(g),
	}
}

func (v *CmdLaunchdList) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (v *CmdLaunchdList) ParseArgv(ctx *cli.Context) error {
	v.format = ctx.String("format")
	return nil
}

func (v *CmdLaunchdList) Run() error {
	if v.format == "json" {
		servicesStatus, err := listServices()
		if err != nil {
			return err
		}
		out, err := json.MarshalIndent(servicesStatus, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintf(os.Stdout, "%s\n", out)
	} else if v.format == "" {
		return showServices(v.G().UI.GetTerminalUI().OutputWriter())
	} else {
		return fmt.Errorf("Invalid format: %s", v.format)
	}
	return nil
}

type CmdLaunchdStatus struct {
	libkb.Contextified
	format string
	label  string
	name   string
}

func NewCmdLaunchdStatusRunner(g *libkb.GlobalContext) *CmdLaunchdStatus {
	return &CmdLaunchdStatus{
		Contextified: libkb.NewContextified(g),
	}
}

func (v *CmdLaunchdStatus) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (v *CmdLaunchdStatus) ParseArgv(ctx *cli.Context) error {
	args := ctx.Args()
	if len(args) < 1 {
		return fmt.Errorf("No service name specified.")
	}
	v.name = args[0]
	v.format = ctx.String("format")
	return nil
}

func (v *CmdLaunchdStatus) Run() error {
	var st keybase1.ServiceStatus
	if v.name == "service" {
		st = keybaseServiceStatus(v.G(), v.label)
	} else if v.name == "kbfs" {
		st = kbfsServiceStatus(v.G(), v.label)
	} else {
		return fmt.Errorf("Invalid service name: %s", v.name)
	}

	if v.format == "json" {
		out, err := json.MarshalIndent(st, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintf(os.Stdout, "%s\n", out)
	} else if v.format == "" {

		fmt.Fprintf(os.Stdout, "%#v\n", st)
	}
	return nil
}
