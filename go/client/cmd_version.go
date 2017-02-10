// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type mode int

const (
	modeNormal mode = iota
	modeShort
	modeVerbose
)

type CmdVersion struct {
	mode mode
	svc  bool
	libkb.Contextified
}

func NewCmdVersionRunner(g *libkb.GlobalContext) *CmdVersion {
	return &CmdVersion{
		mode:         modeNormal,
		svc:          true,
		Contextified: libkb.NewContextified(g),
	}
}

func NewCmdVersion(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "version",
		Usage: "Print out version and build information",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "f, format",
				Usage: "Alternate format for version output. Specify 's' for simple (1.2.3) or 'v' for verbose. Default (blank) includes build number (1.2.3-400).",
			},
			cli.BoolFlag{
				Name:  "S, no-service",
				Usage: "Don't report on the service's build information",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdVersionRunner(g), "version", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetSkipOutOfDateCheck()
		},
	}
}

func (v *CmdVersion) ParseArgv(c *cli.Context) error {
	switch c.String("format") {
	case "s":
		v.mode = modeShort
	case "v":
		v.mode = modeVerbose
	}
	v.svc = !c.Bool("S")
	return nil
}

func (v *CmdVersion) Run() error {
	var err error
	v.runLocal()
	if v.svc {
		err = v.runService()
	}
	return err
}

func (v *CmdVersion) runService() error {
	cli, err := GetConfigClient(v.G())
	if err != nil {
		v.G().Log.Debug("no service running: %v", err)
		return nil
	}
	res, err := cli.GetConfig(context.TODO(), 0)
	if err != nil {
		return err
	}

	dui := v.G().UI.GetDumbOutputUI()

	switch v.mode {
	case modeShort:
		dui.Printf("Service: %s\n", res.VersionShort)
	case modeNormal:
		dui.Printf("Service: %s\n", res.Version)
	case modeVerbose:
		dui.Printf("\n--------- Service Version Information -------\n")
		dui.Printf("%s\n", res.VersionFull)
	}
	return nil
}

func (v *CmdVersion) runLocal() {
	dui := v.G().UI.GetDumbOutputUI()
	prfx := ""
	if v.svc {
		prfx = "Client:  "
	}
	switch v.mode {
	case modeShort:
		dui.Printf("%s%s\n", prfx, libkb.Version)
	case modeNormal:
		dui.Printf("%s%s\n", prfx, libkb.VersionString())
	case modeVerbose:
		libkb.VersionMessage(func(s string) { dui.Printf("%s\n", s) })
	}
}

func (v *CmdVersion) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
