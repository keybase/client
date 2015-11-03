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
		Usage:        "Manage keybase launchd services",
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

			envVars := make(map[string]string)
			envVars["PATH"] = "/sbin:/usr/sbin:/bin:/usr/bin:/usr/local/bin"
			envVars["KEYBASE_LABEL"] = label
			envVars["KEYBASE_LOG_FORMAT"] = "file"
			envVars["KEYBASE_RUNTIME_DIR"] = g.Env.GetRuntimeDir()

			plist := launchd.NewPlist(label, binPath, plistArgs, envVars)
			err := launchd.Install(plist, g.Log)
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
			err := launchd.Uninstall(args[0], g.Log)
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
		Action: func(c *cli.Context) {
			// TODO: Use ChooseCommand
			var err error
			err = launchd.ShowServices([]string{"keybase.service", "homebrew.mxcl.keybase"}, "Keybase", g.Log)
			if err != nil {
				g.Log.Fatalf("%v", err)
			}
			err = launchd.ShowServices([]string{"keybase.kbfs.", "homebrew.mxcl.kbfs"}, "KBFS", g.Log)
			if err != nil {
				g.Log.Fatalf("%v", err)
			}
			os.Exit(0)
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
			err := launchd.Restart(args[0], g.Log)
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
			err := launchd.Start(args[0], g.Log)
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
			err := launchd.Stop(args[0], g.Log)
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
		},
		ArgumentHelp: "<service-name>",
		Usage:        "Status for keybase launchd service, including for installing or updating",
		Action: func(c *cli.Context) {
			// This is to bypass the logui protocol registration in main.go which is
			// triggering a connection before our Run() is called. See that file for
			// more info.
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.ChooseCommand(NewCmdLaunchdStatusRunner(g), "status", c)
		},
	}
}

type CmdLaunchdStatus struct {
	libkb.Contextified
	name          string
	bundleVersion string
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
	v.bundleVersion = ctx.String("bundle-version")
	return nil
}

func (v *CmdLaunchdStatus) Run() error {
	var st keybase1.ServiceStatus
	if v.name == "service" {
		st = KeybaseServiceStatus(v.G(), v.bundleVersion)
	} else if v.name == "kbfs" {
		st = KBFSServiceStatus(v.G(), v.bundleVersion)
	} else {
		return fmt.Errorf("Invalid service name: %s", v.name)
	}

	out, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return err
	}

	// TODO: Terminal is not available when running from another program
	// (/dev/tty is not configured).
	fmt.Fprintf(os.Stdout, "%s\n", out)
	return nil
}
