// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/go-updater"
	"github.com/keybase/go-updater/sources"
	"golang.org/x/net/context"
)

func NewCmdUpdate(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "update",
		Usage:        "The updater",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdUpdateCheck(cl, g),
			NewCmdUpdateRun(cl, g),
			NewCmdUpdateRunLocal(cl, g),
			NewCmdUpdateCheckInUse(cl, g),
			NewCmdUpdateNotify(cl, g),
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
		Usage:        "Trigger an update check (in the service)",
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
	if err := checkBrew(); err != nil {
		return err
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

	return client.UpdateCheck(context.TODO(), v.force)
}

func NewCmdUpdateRun(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	defaultOptions := engine.DefaultUpdaterOptions(g)
	return cli.Command{
		Name:         "run",
		Flags:        optionFlags(defaultOptions),
		ArgumentHelp: "",
		Usage:        "Run the updater with custom options",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdUpdateRunRunner(g, defaultOptions), "run", c)
		},
	}
}

type CmdUpdateRun struct {
	libkb.Contextified
	options *keybase1.UpdateOptions
}

func NewCmdUpdateRunRunner(g *libkb.GlobalContext, options keybase1.UpdateOptions) *CmdUpdateRun {
	return &CmdUpdateRun{
		Contextified: libkb.NewContextified(g),
		options:      &options,
	}
}

func (v *CmdUpdateRun) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}

func (v *CmdUpdateRun) ParseArgv(ctx *cli.Context) error {
	return parseOptions(ctx, v.options)
}

func checkBrew() error {
	if libkb.IsBrewBuild {
		return fmt.Errorf("Update is not supported for brew install. Use \"brew update && brew upgrade keybase\" instead.")
	}
	return nil
}

func (v *CmdUpdateRun) Run() error {
	if err := checkBrew(); err != nil {
		return err
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

type CmdUpdateRunLocal struct {
	libkb.Contextified
	options *keybase1.UpdateOptions
}

func NewCmdUpdateRunLocal(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	defaultOptions := engine.DefaultUpdaterOptions(g)
	return cli.Command{
		Name:         "client",
		Flags:        optionFlags(defaultOptions),
		ArgumentHelp: "",
		Usage:        "Run update with custom options from the client",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdUpdateRunLocalRunner(g, defaultOptions), "client", c)
		},
	}
}

func NewCmdUpdateRunLocalRunner(g *libkb.GlobalContext, options keybase1.UpdateOptions) *CmdUpdateRunLocal {
	return &CmdUpdateRunLocal{
		Contextified: libkb.NewContextified(g),
		options:      &options,
	}
}

func (v *CmdUpdateRunLocal) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}

func (v *CmdUpdateRunLocal) ParseArgv(ctx *cli.Context) error {
	return parseOptions(ctx, v.options)
}

func (v *CmdUpdateRunLocal) Run() error {
	if err := checkBrew(); err != nil {
		return err
	}

	source, err := engine.NewUpdateSourceFromString(v.G(), v.options.Source)
	if err != nil {
		return err
	}
	upd := updater.NewUpdater(*v.options, source, v.G().Env, v.G().Log)
	ctx := engine.NewUpdaterContext(v.G())
	_, err = upd.Update(ctx, v.options.Force, true)
	return err
}

func parseOptions(ctx *cli.Context, options *keybase1.UpdateOptions) error {
	currentVersion := ctx.String("current-version")
	if currentVersion != "" {
		options.Version = currentVersion
	}

	destinationPath := ctx.String("destination-path")
	if destinationPath != "" {
		options.DestinationPath = destinationPath
	}

	source := ctx.String("source")
	if source != "" {
		options.Source = source
	}

	options.URL = ctx.String("url")
	options.Force = ctx.Bool("force")
	options.SignaturePath = ctx.String("signature")

	return nil
}

func optionFlags(defaultOptions keybase1.UpdateOptions) []cli.Flag {
	return []cli.Flag{
		cli.StringFlag{
			Name:  "e, current-version",
			Usage: fmt.Sprintf("Current version, default is %q", defaultOptions.Version),
		},
		cli.StringFlag{
			Name:  "d, destination-path",
			Usage: fmt.Sprintf("Destination of where to apply update, default is %q", defaultOptions.DestinationPath),
		},
		cli.StringFlag{
			Name: "s, source",
			Usage: fmt.Sprintf("Update source (%s), default is %q",
				sources.UpdateSourcesDescription(", "),
				defaultOptions.Source),
		},
		cli.StringFlag{
			Name:  "u, url",
			Usage: "Custom URL",
		},
		cli.BoolFlag{
			Name:  "f, force",
			Usage: "Force update",
		},
		cli.StringFlag{
			Name:  "v, signature",
			Usage: "Signature",
		},
	}
}

func NewCmdUpdateCheckInUse(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "check-in-use",
		ArgumentHelp: "",
		Usage:        "Check if we are in use (safe for restart)",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdUpdateCheckInUseRunner(g), "check-in-use", c)
		},
	}
}

type CmdUpdateCheckInUse struct {
	libkb.Contextified
}

func NewCmdUpdateCheckInUseRunner(g *libkb.GlobalContext) *CmdUpdateCheckInUse {
	return &CmdUpdateCheckInUse{
		Contextified: libkb.NewContextified(g),
	}
}

func (v *CmdUpdateCheckInUse) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}

func (v *CmdUpdateCheckInUse) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (v *CmdUpdateCheckInUse) Run() error {
	inUse := install.IsInUse(v.G().Env.GetMountDir(), G.Log)
	if inUse {
		os.Exit(100)
	}
	return nil
}

func NewCmdUpdateNotify(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "notify",
		ArgumentHelp: "<event>",
		Usage:        "Notify the service about an update event",
		Action: func(c *cli.Context) {
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.ChooseCommand(NewCmdUpdateNotifyRunner(g), "notify", c)
		},
	}
}

type CmdUpdateNotify struct {
	libkb.Contextified
	event string
}

func NewCmdUpdateNotifyRunner(g *libkb.GlobalContext) *CmdUpdateNotify {
	return &CmdUpdateNotify{
		Contextified: libkb.NewContextified(g),
	}
}

func (v *CmdUpdateNotify) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}

func (v *CmdUpdateNotify) ParseArgv(ctx *cli.Context) error {
	v.event = ctx.Args().First()
	if v.event == "" {
		return fmt.Errorf("No event specified")
	}
	return nil
}

func (v *CmdUpdateNotify) Run() error {
	v.G().Log.Debug("Received event: %s", v.event)
	switch v.event {
	case "after-apply":
		return engine.AfterUpdateApply(v.G(), true)
	default:
		return fmt.Errorf("Unrecognized event: %s", v.event)
	}
}
