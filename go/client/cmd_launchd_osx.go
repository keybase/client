// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdLaunchd(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "launchd",
		Usage:        "Manage launchd",
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

// defaultLaunchdWait is how long we should wait after install, start, for launchd services
const defaultLaunchdWait = 10 * time.Second

func NewCmdLaunchdInstall(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "install",
		Usage:        "Install a launchd service",
		ArgumentHelp: "<label> <executable> <logfilename> <args>",
		Action: func(c *cli.Context) {
			// TODO: Use ChooseCommand
			args := c.Args()
			if len(args) < 1 {
				g.Log.Fatalf("No label specified.")
			}
			if len(args) < 2 {
				g.Log.Fatalf("No executable specified.")
			}
			if len(args) < 3 {
				g.Log.Fatalf("No log file name specified.")
			}

			label := args[0]
			binPath := args[1]
			logFileName := args[2]
			plistArgs := args[3:]
			envVars := install.DefaultLaunchdEnvVars(label)

			plist := launchd.NewPlist(label, binPath, plistArgs, envVars, logFileName, "")
			err := launchd.Install(plist, defaultLaunchdWait, g.Log)
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
		Usage:        "Uninstall a Keybase launchd service",
		ArgumentHelp: "<label>",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdLaunchdActionRunner(g, "uninstall"), "uninstall", c)
		},
	}
}

func NewCmdLaunchdList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "list",
		Usage: "List Keybase launchd services",
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
		Usage:        "Restart a Keybase launchd service",
		ArgumentHelp: "<label>",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdLaunchdActionRunner(g, "restart"), "restart", c)
		},
	}
}

func NewCmdLaunchdStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "start",
		Usage:        "Start a Keybase launchd service",
		ArgumentHelp: "<label>",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdLaunchdActionRunner(g, "start"), "start", c)
		},
	}
}

func NewCmdLaunchdStop(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "stop",
		Usage:        "Stop a Keybase launchd service",
		ArgumentHelp: "<label>",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdLaunchdActionRunner(g, "stop"), "stop", c)
		},
	}
}

func NewCmdLaunchdStatus(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "status",
		Usage:        "Status for a Keybase launchd service",
		ArgumentHelp: "<service-name>",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "b, bundle-version",
				Usage: "Bundle version",
			},
			cli.StringFlag{
				Name:  "f, format",
				Usage: "Format for output. Specify 'j' for JSON or blank for default.",
			},
			cli.DurationFlag{
				Name:  "t, timeout",
				Usage: "Timeout as duration, such as '10s' or '1m'.",
			},
		},
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
		servicesStatus, err := install.ListServices(v.G(), 0, v.G().Log)
		if err != nil {
			return err
		}
		out, err := json.MarshalIndent(servicesStatus, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintf(os.Stdout, "%s\n", out)
	} else if v.format == "" {
		return v.ShowServices()
	} else {
		return fmt.Errorf("Invalid format: %s", v.format)
	}
	return nil
}

func (v *CmdLaunchdList) ShowServices() error {
	err := v.showServices([]string{"keybase.service.", "homebrew.mxcl.keybase"}, "Keybase")
	if err != nil {
		return err
	}
	err = v.showServices([]string{"keybase.kbfs.", "homebrew.mxcl.kbfs"}, "KBFS")
	if err != nil {
		return err
	}
	err = v.showServices([]string{"keybase.updater."}, "Updater")
	if err != nil {
		return err
	}
	return nil
}

func (v *CmdLaunchdList) showServices(filters []string, name string) (err error) {
	services, err := launchd.ListServices(filters)
	if err != nil {
		return
	}
	ui := v.G().UI.GetTerminalUI()
	if len(services) > 0 {
		for _, service := range services {
			ui.Printf("%s [%s]\n", service.StatusDescription(), name)
		}
	} else {
		ui.Printf("No %s services.\n", name)
	}
	return
}

type CmdLaunchdStatus struct {
	libkb.Contextified
	format  string
	label   install.ServiceLabel
	timeout time.Duration
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

	// Resolve any label "aliases"
	labelStr := args[0]
	switch labelStr {
	case "service":
		labelStr = install.DefaultServiceLabel(v.G().Env.GetRunMode())
	case "kbfs":
		labelStr = install.DefaultKBFSLabel(v.G().Env.GetRunMode())
	case "updater":
		labelStr = install.DefaultUpdaterLabel(v.G().Env.GetRunMode())
	}

	label, err := install.NewServiceLabel(labelStr)
	if err != nil {
		return err
	}
	v.label = label

	v.format = ctx.String("format")
	v.timeout = ctx.Duration("timeout")
	if v.timeout == 0 {
		v.timeout = defaultLaunchdWait
	}
	return nil
}

func (v *CmdLaunchdStatus) Run() error {
	serviceStatus, err := install.ServiceStatus(v.G(), v.label, v.timeout, v.G().Log)
	if err != nil {
		return err
	}

	out, err := json.MarshalIndent(serviceStatus, "", "  ")
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stdout, "%s\n", out)
	return nil
}

type CmdLaunchdAction struct {
	libkb.Contextified
	action string
	label  string
}

func NewCmdLaunchdActionRunner(g *libkb.GlobalContext, action string) *CmdLaunchdAction {
	return &CmdLaunchdAction{
		Contextified: libkb.NewContextified(g),
		action:       action,
	}
}

func (v *CmdLaunchdAction) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (v *CmdLaunchdAction) ParseArgv(ctx *cli.Context) error {
	args := ctx.Args()
	if len(args) < 1 {
		return fmt.Errorf("Need to specify launchd label")
	}
	v.label = args[0]
	return nil
}

func (v *CmdLaunchdAction) Run() error {
	switch v.action {
	case "start":
		return launchd.Start(v.label, defaultLaunchdWait, v.G().Log)
	case "restart":
		return launchd.Restart(v.label, defaultLaunchdWait, v.G().Log)
	case "stop":
		_, stopErr := launchd.Stop(v.label, defaultLaunchdWait, v.G().Log)
		return stopErr
	case "uninstall":
		return launchd.Uninstall(v.label, defaultLaunchdWait, v.G().Log)
	}

	return nil
}

func startLaunchdService(g *libkb.GlobalContext, label string, serviceInfoPath string, wait bool) error {
	launchService := launchd.NewService(label)
	launchService.SetLogger(g.Log)
	err := launchService.Start(defaultLaunchdWait)
	if err != nil {
		return err
	}
	if wait {
		return WaitForService(g, launchService, serviceInfoPath)
	}
	return nil
}

func restartLaunchdService(g *libkb.GlobalContext, label string, serviceInfoPath string) error {
	launchService := launchd.NewService(label)
	launchService.SetLogger(g.Log)
	err := launchService.Restart(defaultLaunchdWait)
	if err != nil {
		return err
	}
	return WaitForService(g, launchService, serviceInfoPath)
}

func WaitForService(g *libkb.GlobalContext, launchService launchd.Service, serviceInfoPath string) error {
	launchdStatus, err := launchService.WaitForStatus(defaultLaunchdWait, 500*time.Millisecond)
	if err != nil {
		return err
	}
	if launchdStatus == nil {
		return fmt.Errorf("%s was not found", launchService.Label())
	}
	if launchdStatus.IsErrored() {
		return fmt.Errorf("%s is not running (exit status %s)", launchdStatus.Label(), launchdStatus.LastExitStatus())
	}
	_, err = libkb.WaitForServiceInfoFile(serviceInfoPath, launchdStatus.Label(), launchdStatus.Pid(), defaultLaunchdWait, g.Log)
	return err
}
