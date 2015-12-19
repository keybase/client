// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"runtime"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/install/sources"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
	"github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

func NewCmdUpdate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "update",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "c, check-only",
				Usage: "Only check for update.",
			},
			cli.StringFlag{
				Name:  "e, current-version",
				Usage: "Current version of to override.",
			},
			cli.StringFlag{
				Name:  "d, destination-path",
				Usage: "Destination of where to apply update.",
			},
			cli.StringFlag{
				Name: "s, source",
				Usage: fmt.Sprintf("Update source (%s). Default is %q.",
					sources.UpdateSourcesDescription(", "),
					string(sources.DefaultUpdateSourceName())),
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
		Usage:        "Update Keybase",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdUpdateRunner(g), "update", c)
		},
	}
}

type CmdUpdate struct {
	libkb.Contextified
	checkOnly bool
	source    string
	config    *keybase1.UpdateConfig
}

func NewCmdUpdateRunner(g *libkb.GlobalContext) *CmdUpdate {
	return &CmdUpdate{
		Contextified: libkb.NewContextified(g),
		config:       install.DefaultUpdaterConfig(g),
	}
}

func (v *CmdUpdate) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}

func (v *CmdUpdate) ParseArgv(ctx *cli.Context) error {
	v.checkOnly = ctx.Bool("check-only")

	currentVersion := ctx.String("current-version")
	if currentVersion != "" {
		v.config.Version = currentVersion
	}

	destinationPath := ctx.String("destination-path")
	if destinationPath != "" {
		v.config.DestinationPath = destinationPath
	}

	v.config.Source = ctx.String("source")
	v.config.Platform = runtime.GOOS
	v.config.URL = ctx.String("url")
	v.config.Force = ctx.Bool("force")

	if v.config.DestinationPath == "" {
		return fmt.Errorf("No default destination path for this environment")
	}

	return nil
}

func (v *CmdUpdate) Run() error {
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

	v.G().Log.Debug("Config: %#v", *v.config)

	_, err = client.Update(context.TODO(), keybase1.UpdateArg{
		Config:    *v.config,
		CheckOnly: v.checkOnly,
	})
	return err
}
