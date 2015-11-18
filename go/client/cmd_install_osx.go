// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
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
				Usage: "Components to install, comma separated. Specify 'cli' for command line, 'service' for service, kbfs for 'kbfs', or blank for all.",
			},
		},
		ArgumentHelp: "",
		Usage:        "",
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

func (v *CmdInstall) ParseArgv(ctx *cli.Context) error {
	v.force = ctx.Bool("force")
	v.format = ctx.String("format")
	v.binPath = ctx.String("bin-path")
	v.installer = ctx.String("installer")
	if ctx.String("components") == "" {
		v.components = []string{"cli", "service", "kbfs"}
	} else {
		v.components = strings.Split(ctx.String("components"), ",")
	}
	return nil
}

func (v *CmdInstall) Run() error {
	var components []keybase1.InstallComponent
	if v.installer == "auto" {
		components = AutoInstallWithStatus(v.G(), v.binPath, v.force)
	} else if v.installer == "" {
		components = Install(v.G(), v.binPath, v.components, v.force)
	} else {
		return fmt.Errorf("Invalid install type: %s", v.installer)
	}
	if v.format == "json" {
		out, err := json.MarshalIndent(components, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintf(os.Stdout, "%s\n", out)
	} else {
		for _, c := range components {
			v.G().UI.GetDumbOutputUI().Printf("%s: %s %s\n", c.Name, c.Status.Name, c.Status.Desc)
		}
	}
	return nil
}
