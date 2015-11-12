// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"

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
			envVars := defaultEnvVars(g, label)

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
		servicesStatus, err := ListServices()
		if err != nil {
			return err
		}
		out, err := json.MarshalIndent(servicesStatus, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintf(os.Stdout, "%s\n", out)
	} else if v.format == "" {
		return ShowServices(v.G().UI.GetTerminalUI().OutputWriter())
	} else {
		return fmt.Errorf("Invalid format: %s", v.format)
	}
	return nil
}

type CmdLaunchdStatus struct {
	libkb.Contextified
	format        string
	label         string
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
	v.format = ctx.String("format")
	return nil
}

func (v *CmdLaunchdStatus) Run() error {
	var st keybase1.ServiceStatus
	if v.name == "service" {
		st = KeybaseServiceStatus(v.G(), v.label, v.bundleVersion)
	} else if v.name == "kbfs" {
		st = KBFSServiceStatus(v.G(), v.label, v.bundleVersion)
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

func defaultEnvVars(g *libkb.GlobalContext, label string) map[string]string {
	envVars := make(map[string]string)
	envVars["PATH"] = "/sbin:/usr/sbin:/bin:/usr/bin:/usr/local/bin"
	envVars["KEYBASE_LABEL"] = label
	envVars["KEYBASE_LOG_FORMAT"] = "file"
	envVars["KEYBASE_RUNTIME_DIR"] = g.Env.GetRuntimeDir()
	return envVars
}

func BrewAutoInstall(g *libkb.GlobalContext) error {
	label := defaultBrewServiceLabel(g.Env.GetRunMode())
	if label == "" {
		return fmt.Errorf("No service label to install")
	}

	// Check if plist is installed. If so we're already installed and return.
	plistPath := launchd.PlistDestination(label)
	if _, err := os.Stat(plistPath); err == nil {
		return nil
	}

	// Get the full path to this executable using the brew opt bin directory.
	binName := filepath.Base(os.Args[0])
	binPath := filepath.Join("/usr/local/opt", binName, "bin", binName)
	plistArgs := []string{"service"}
	envVars := defaultEnvVars(g, label)

	plist := launchd.NewPlist(label, binPath, plistArgs, envVars)
	err := launchd.Install(plist, ioutil.Discard)
	if err != nil {
		return err
	}

	// Get service install status. This causes us to pause (with timeout) until
	// the service is up.
	kbService := launchd.NewService(label)
	ServiceStatusFromLaunchd(kbService, path.Join(g.Env.GetRuntimeDir(), "keybased.info"))

	return nil
}

func defaultBrewServiceLabel(runMode libkb.RunMode) string {
	name := "homebrew.mxcl.keybase"
	switch runMode {
	case libkb.DevelRunMode:
		return fmt.Sprintf("%s.devel", name)
	case libkb.StagingRunMode:
		return fmt.Sprintf("%s.staging", name)
	case libkb.ProductionRunMode:
		return name
	default:
		return ""
	}
}
