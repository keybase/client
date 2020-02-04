// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdCtlAutostart struct {
	libkb.Contextified
	ToggleOn bool
}

func NewCmdCtlAutostart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	const backtick = "`"

	cmd := &CmdCtlAutostart{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "autostart",
		Usage: `Configure autostart settings via the XDG autostart standard.

    On Linux this creates a file at ~/.config/autostart/keybase.desktop.

	If you change this file after initial install, it will not be changed unless
	you run ` + backtick + `keybase ctl autostart` + backtick + ` or delete
	the sentinel file at ~/.config/keybase/autostart_created.

	If you are using a headless machine or a minimal window manager that doesn't
	respect this standard, you will need to configure autostart in another way.

	If you are running Keybase on a headless machine using systemd, you may be
	interested in enabling the systemd user manager units keybase.service and
	kbfs.service: ` + backtick + `systemctl --user enable keybase kbfs
	keybase-redirector` + backtick + `.


    On Windows, registry and shortcuts are used for this.
`,
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "enable",
				Usage: "Toggle on Keybase, KBFS, and GUI autostart on startup.",
			},
			cli.BoolFlag{
				Name:  "disable",
				Usage: "Toggle off Keybase, KBFS, and GUI autostart on startup.",
			},
		},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "autostart", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (c *CmdCtlAutostart) ParseArgv(ctx *cli.Context) error {
	toggleOn := ctx.Bool("enable")
	toggleOff := ctx.Bool("disable")
	if toggleOn && toggleOff {
		return fmt.Errorf("Cannot specify both --enable and --disable.")
	}
	if !toggleOn && !toggleOff {
		return fmt.Errorf("Must specify either --enable or --disable.")
	}
	c.ToggleOn = toggleOn
	return nil
}

func (c *CmdCtlAutostart) Run() error {
	err := install.ToggleAutostart(c.G(), c.ToggleOn, false)
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdCtlAutostart) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
