// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func NewCmdInstall(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "install",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "f, force",
				Usage: "Force install actions.",
			},
			cli.StringFlag{
				Name:  "o, format",
				Usage: "Format for output. Specify 'j' for JSON or blank for default.",
			},
			cli.StringFlag{
				Name:  "b, bin-path",
				Usage: "Full path to the executable, if it would be ambiguous otherwise.",
			},
			cli.StringFlag{
				Name:  "i, installer",
				Usage: "Installer to use.",
			},
			cli.StringFlag{
				Name:  "c, components",
				Usage: fmt.Sprintf("Components to install, comma separated (%q)", install.ComponentNames),
			},
			cli.DurationFlag{
				Name:  "t, timeout",
				Usage: "Timeout as duration, such as '10s' or '1m'.",
			},
			cli.StringFlag{
				Name:  "source-path",
				Usage: "Source path to app bundle.",
			},
		},
		ArgumentHelp: "",
		Usage:        "Installs Keybase components",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdInstallRunner(g), "install", c)
		},
	}
}

type CmdInstall struct {
	libkb.Contextified
	force      bool
	format     string
	binPath    string
	installer  string
	sourcePath string
	timeout    time.Duration
	components []string
}

func NewCmdInstallRunner(g *libkb.GlobalContext) *CmdInstall {
	return &CmdInstall{
		Contextified: libkb.NewContextified(g),
	}
}

func (v *CmdInstall) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

var defaultInstallComponents = []string{
	install.ComponentNameUpdater.String(),
	install.ComponentNameService.String(),
	install.ComponentNameMountDir.String(),
	install.ComponentNameKBFS.String(),
	install.ComponentNameKBNM.String(),
}

func (v *CmdInstall) ParseArgv(ctx *cli.Context) error {
	v.force = ctx.Bool("force")
	v.format = ctx.String("format")
	v.binPath = ctx.String("bin-path")
	v.installer = ctx.String("installer")
	v.timeout = ctx.Duration("timeout")
	v.sourcePath = ctx.String("source-path")
	if v.timeout == 0 {
		v.timeout = 11 * time.Second
	}
	if ctx.String("components") == "" {
		v.components = defaultInstallComponents
	} else {
		v.components = strings.Split(ctx.String("components"), ",")
	}

	// Brew uses the auto installer by default
	if libkb.IsBrewBuild && v.installer == "" {
		v.installer = "auto"
	}

	return nil
}

func (v *CmdInstall) runInstall() keybase1.InstallResult {
	err := install.CheckIfValidLocation()
	if err != nil {
		v.G().Log.Errorf("%s", err)
		return keybase1.InstallResult{Status: err.Status(), Fatal: true}
	}

	if v.installer == "auto" {
		return install.AutoInstallWithStatus(v.G(), v.binPath, v.force, v.timeout, v.G().Log)
	} else if v.installer == "" {
		return install.Install(v.G(), v.binPath, v.sourcePath, v.components, v.force, v.timeout, v.G().Log)
	}

	return keybase1.InstallResult{Status: keybase1.StatusFromCode(keybase1.StatusCode_SCInstallError, fmt.Sprintf("Invalid installer: %s", v.installer))}
}

func (v *CmdInstall) Run() error {
	result := v.runInstall()
	if v.format == "json" {
		out, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintf(os.Stdout, "%s\n", out)
	}
	return nil
}

var defaultUninstallComponents = []string{
	install.ComponentNameService.String(),
	install.ComponentNameKBFS.String(),
	install.ComponentNameKBNM.String(),
	install.ComponentNameMountDir.String(),
	install.ComponentNameUpdater.String(),
	install.ComponentNameFuse.String(),
	install.ComponentNameHelper.String(),
	install.ComponentNameCLI.String(),
}

func NewCmdUninstall(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "uninstall",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "o, format",
				Usage: "Format for output. Specify 'j' for JSON or blank for default.",
			},
			cli.StringFlag{
				Name:  "c, components",
				Usage: fmt.Sprintf("Components to uninstall, comma separated (%q)", install.ComponentNames),
			},
		},
		ArgumentHelp: "",
		Usage:        "Uninstalls Keybase components",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdUninstallRunner(g), "uninstall", c)
		},
	}
}

type CmdUninstall struct {
	libkb.Contextified
	format     string
	components []string
	isDefault  bool
}

func NewCmdUninstallRunner(g *libkb.GlobalContext) *CmdUninstall {
	return &CmdUninstall{
		Contextified: libkb.NewContextified(g),
	}
}

func (v *CmdUninstall) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (v *CmdUninstall) ParseArgv(ctx *cli.Context) error {
	v.format = ctx.String("format")
	if ctx.String("components") == "" {
		v.isDefault = true
		if libkb.IsBrewBuild {
			v.components = []string{"service"}
		} else {
			v.components = defaultUninstallComponents
		}
	} else {
		v.components = strings.Split(ctx.String("components"), ",")
	}
	return nil
}

func (v *CmdUninstall) Run() error {
	bundlePath, err := install.AppBundleForPath()
	if err != nil {
		return err
	}
	result := install.Uninstall(v.G(), v.components, v.G().Log)
	if v.format == "json" {
		out, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintf(os.Stdout, "%s\n", out)
	} else {
		if v.isDefault {
			t := v.G().UI.GetTerminalUI()
			t.Printf("\nYou can now remove %s to complete your uninstall.\n", bundlePath)
		}
	}
	return nil
}

func DiagnoseSocketError(ui libkb.UI, err error) {
	t := ui.GetTerminalUI()
	services, err := launchd.ListServices([]string{"keybase.service.", "homebrew.mxcl.keybase"})
	if err != nil {
		t.Printf("Error checking launchd services: %s\n\n", err)
		return
	}

	if len(services) == 0 {
		if libkb.IsBrewBuild {
			t.Printf("\nThere are no Keybase services installed, you might try running:\n\n\tkeybase install\n\n")
		} else {
			bundlePath, err := install.AppBundleForPath()
			if err != nil {
				t.Printf("No app bundle: %s\n\n", err)
				return
			}
			t.Printf("\nKeybase isn't running. To start, you can run:\n\n\topen %s\n\n", bundlePath)
		}
	} else if len(services) > 1 {
		t.Printf("\nWe found multiple services:\n")
		for _, service := range services {
			t.Printf("  " + service.StatusDescription() + "\n")
		}
		t.Printf("\n")
	} else if len(services) == 1 {
		service := services[0]
		status, err := service.LoadStatus()
		if err != nil {
			t.Printf("Error checking service status(%s): %v\n\n", service.Label(), err)
		} else {
			if status == nil || !status.IsRunning() {
				t.Printf("\nWe found a Keybase service (%s) but it's not running.\n", service.Label())
				cmd := fmt.Sprintf("keybase launchd start %s", service.Label())
				t.Printf("You might try starting it: " + cmd + "\n\n")
			} else {
				t.Printf("\nWe couldn't connect but there is a Keybase service (%s) running (%s).\n\n", status.Label(), status.Pid())
				cmd := fmt.Sprintf("keybase launchd restart %s", service.Label())
				t.Printf("You might try restarting it: " + cmd + "\n\n")
			}
		}
	}
}
