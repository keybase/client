// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
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
		},
		ArgumentHelp: "",
		Usage:        "",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.ChooseCommand(NewCmdInstallRunner(g), "install", c)
		},
	}
}

type CmdInstall struct {
	libkb.Contextified
	force  bool
	format string
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
	return nil
}

func (v *CmdInstall) Run() error {
	status := install(v.G(), v.force)
	if v.format == "json" {
		out, err := json.MarshalIndent(status, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintf(os.Stdout, "%s\n", out)
	}
	return nil
}
