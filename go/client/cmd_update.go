// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/updater/sources"
	"github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

func NewCmdUpdate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "update",
		Usage:        "The updater",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdUpdateCheck(cl, g),
			NewCmdUpdateCustom(cl, g),
		},
	}
}

func NewCmdUpdateCheck(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "check",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "Force update.",
			},
		},
		ArgumentHelp: "",
		Usage:        "Perform an update check",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdUpdateCheckRunner(g), "check", c)
		},
	}
}

type CmdUpdateCheck struct {
	libkb.Contextified
	force bool
}

func NewCmdUpdateCheckRunner(g *libkb.GlobalContext) *CmdUpdateCheck {
	return &CmdUpdateCheck{
		Contextified: libkb.NewContextified(g),
	}
}

func (v *CmdUpdateCheck) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}

func (v *CmdUpdateCheck) ParseArgv(ctx *cli.Context) error {
	v.force = ctx.Bool("force")
	return nil
}

func (v *CmdUpdateCheck) Run() error {
	protocols := []rpc.Protocol{
		NewUpdateUIProtocol(v.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, v.G()); err != nil {
		return err
	}

	client, err := GetUpdateClient(v.G())
	if err != nil {
		return err
	}

	return client.UpdateCheck(context.TODO(), v.force)
}

func NewCmdUpdateCustom(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	defaultOptions := engine.DefaultUpdaterOptions(g)
	return cli.Command{
		Name: "custom",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "e, current-version",
				Usage: fmt.Sprintf("Current version. Default is %q.", defaultOptions.Version),
			},
			cli.StringFlag{
				Name:  "d, destination-path",
				Usage: fmt.Sprintf("Destination of where to apply update. Default is %q.", defaultOptions.DestinationPath),
			},
			cli.StringFlag{
				Name: "s, source",
				Usage: fmt.Sprintf("Update source (%s). Default is %q.",
					sources.UpdateSourcesDescription(", "),
					defaultOptions.Source),
			},
			cli.StringFlag{
				Name:  "u, url",
				Usage: "Custom URL.",
			},
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "Force update.",
			},
		},
		ArgumentHelp: "",
		Usage:        "Run the updater with custom options",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdUpdateCustomRunner(g, defaultOptions), "run", c)
		},
	}
}

type CmdUpdateCustom struct {
	libkb.Contextified
	checkOnly bool
	source    string
	options   *keybase1.UpdateOptions
}

func NewCmdUpdateCustomRunner(g *libkb.GlobalContext, options *keybase1.UpdateOptions) *CmdUpdateCustom {
	return &CmdUpdateCustom{
		Contextified: libkb.NewContextified(g),
		options:      options,
	}
}

func (v *CmdUpdateCustom) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}

func (v *CmdUpdateCustom) ParseArgv(ctx *cli.Context) error {
	currentVersion := ctx.String("current-version")
	if currentVersion != "" {
		v.options.Version = currentVersion
	}

	destinationPath := ctx.String("destination-path")
	if destinationPath != "" {
		v.options.DestinationPath = destinationPath
	}

	source := ctx.String("source")
	if source != "" {
		v.options.Source = source
	}

	v.options.URL = ctx.String("url")
	v.options.Force = ctx.Bool("force")

	if v.options.DestinationPath == "" {
		return fmt.Errorf("No default destination path for this environment")
	}

	return nil
}

func (v *CmdUpdateCustom) Run() error {
	if libkb.IsBrewBuild {
		return fmt.Errorf("Update is not supported for brew install. Use \"brew update && brew upgrade keybase\" instead.")
	}

	protocols := []rpc.Protocol{
		NewUpdateUIProtocol(v.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, v.G()); err != nil {
		return err
	}

	client, err := GetUpdateClient(v.G())
	if err != nil {
		return err
	}

	v.G().Log.Debug("Options: %#v", *v.options)

	_, err = client.Update(context.TODO(), *v.options)
	return err
}
