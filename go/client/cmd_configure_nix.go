// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin,!windows

package client

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

func NewCmdConfigure(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "configure",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdConfigureAutostart(cl, g),
			NewCmdConfigureRedirector(cl, g),
		},
	}
}

type CmdConfigureAutostart struct {
	libkb.Contextified
	ToggleOn bool
}

func NewCmdConfigureAutostart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdConfigureAutostart{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:  "autostart",
		Usage: "Configure autostart settings",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "toggle-on",
				Usage: "Toggle on Keybase, KBFS, and GUI autostart on startup.",
			},
			cli.BoolFlag{
				Name:  "toggle-off",
				Usage: "Toggle off Keybase, KBFS, and GUI autostart on startup.",
			},
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "Override local changes to autostart file.",
			},
		},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "autostart", c)
		},
	}
}

func (v *CmdConfigureAutostart) ParseArgv(ctx *cli.Context) error {
	toggleOn := ctx.Bool("toggle-on")
	toggleOff := ctx.Bool("toggle-off")
	if toggleOn && toggleOff {
		return fmt.Errorf("Cannot specify both --toggle-on and --toggle-off.")
	}
	if !toggleOn && !toggleOff {
		return fmt.Errorf("Must specify either --toggle-on or --toggle-off.")
	}
	v.ToggleOn = toggleOn
	return nil
}

func (v *CmdConfigureAutostart) Run() error {
	err := install.ToggleAutostart(v.G(), v.ToggleOn, false)
	if err != nil {
		return err
	}
	return nil
}

func (v *CmdConfigureAutostart) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

type CmdConfigureRedirector struct {
	libkb.Contextified
	Toggle   bool
	ToggleOn bool
	Status   bool
}

func NewCmdConfigureRedirector(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdConfigureRedirector{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:  "redirector",
		Usage: "Configure redirector settings. Must pass the option --use-root-config-file=true to use. May require root privileges.",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "toggle-on",
				Usage: "Toggle on the KBFS redirector. **Requires root privileges.**",
			},
			cli.BoolFlag{
				Name:  "toggle-off",
				Usage: "Toggle off the KBFS redirector. **Requires root privileges.**",
			},
			cli.BoolFlag{
				Name:  "status",
				Usage: "Print whether the KBFS redirector is enabled or disabled.",
			},
		},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "redirector", c)
		},
	}
}

func xor3(a, b, c bool) bool {
	ret := false
	ret = ret != a
	ret = ret != b
	ret = ret != c
	return ret
}

func (v *CmdConfigureRedirector) ParseArgv(ctx *cli.Context) error {
	toggleOn := ctx.Bool("toggle-on")
	toggleOff := ctx.Bool("toggle-off")
	status := ctx.Bool("status")
	if !xor3(toggleOn, toggleOff, status) || (toggleOn && toggleOff && status) {
		return fmt.Errorf("Must specify exactly one of --toggle-on, --toggle-off, --status.")
	}
	return nil
}

func (v *CmdConfigureRedirector) Run() error {
	if v.G().Env.GetConfigFilename() != v.G().Env.GetRootConfigFilename() {
		return fmt.Errorf("Must pass --use-root-config-file=true.")
	}

	configCli, err := GetConfigClient(v.G())
	if err != nil {
		return err
	}

	enabled := false

	value, err := configCli.GetValue(context.TODO(), libkb.DisableRootRedirectorConfigKey)
	if value.IsNull {
		enabled = true
	}
	if value.B == nil {
		return fmt.Errorf("config corruption: value not a boolean value; please run `keybase --use-root-config-file=true configure redirector toggle-{on/off}` to reset.")
	}
	enabled = *value.B

	if v.Status {
		if enabled {
			fmt.Println("enabled")
		} else {
			fmt.Println("disabled")
		}
		return nil
	}

	setValueArgValue := keybase1.ConfigValue{B: &v.ToggleOn}
	setValueArg := keybase1.SetValueArg{Path: libkb.DisableRootRedirectorConfigKey, Value: setValueArgValue}
	err = configCli.SetValue(context.TODO(), setValueArg)
	if err != nil {
		return err
	}

	redirectorPath, err := exec.LookPath("keybase-redirector")
	if err != nil {
		return err
	}
	var redirectorPerm os.FileMode
	if v.ToggleOn {
		// suid set, octal
		redirectorPerm = os.FileMode(04755)
	} else {
		// suid unset, octal
		redirectorPerm = os.FileMode(0755)
	}
	err = os.Chmod(redirectorPath, redirectorPerm)
	if err != nil {
		v.G().Log.Errorf("Failed to chmod %s. Do you have root privileges?", redirectorPath)

		// Attempt to restore old config value
		setValueArgValue := keybase1.ConfigValue{B: &enabled}
		setValueArg := keybase1.SetValueArg{Path: libkb.DisableRootRedirectorConfigKey, Value: setValueArgValue}
		configErr := configCli.SetValue(context.TODO(), setValueArg)
		if configErr != nil {
			v.G().Log.Warning("Failed to revert config after chmod failure; config may be in inconsistent state.")
			return fmt.Errorf("Error during chmod: %s. Error during config revert: %s.", err, configErr)
		}

		return err
	}

	fmt.Println("Root redirector configuration and permissions updated.")
	if v.ToggleOn {
		fmt.Println("Please run `$ run_keybase` to start the redirector for each user using KBFS.")
	} else {
		fmt.Println("Please run `# killall keybase-redirector` to stop the redirector for all users.")
	}

	return nil
}

func (v *CmdConfigureRedirector) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
