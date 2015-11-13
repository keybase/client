// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"io/ioutil"

	"github.com/blang/semver"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type CmdCheck struct {
	libkb.Contextified
}

func NewCmdCheckRunner(g *libkb.GlobalContext) *CmdCheck {
	return &CmdCheck{
		Contextified: libkb.NewContextified(g),
	}
}

func NewCmdCheck(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "check",
		Usage: "Check that Keybase is running properly.",
		Flags: []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdCheckRunner(g), "check", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (v *CmdCheck) ParseArgv(c *cli.Context) error {
	return nil
}

func (v *CmdCheck) Run() error {
	if libkb.IsBrewBuild {
		return v.brewTest()
	}
	return nil
}

func (v *CmdCheck) brewTest() error {
	versionClient := libkb.VersionString()
	versionService, err := v.versionForService()
	if err != nil {
		return err
	}

	// If version is empty, service is not running and return.
	if versionService == "" {
		return nil
	}

	// We'll check and restart the service if there is a new version.
	semverClient, err := semver.Make(versionClient)
	if err != nil {
		return err
	}
	semverService, err := semver.Make(versionService)
	if err != nil {
		return err
	}
	v.G().Log.Debug("Version check %s, %s", semverClient, semverService)
	if semverClient.GT(semverService) {
		label := defaultBrewServiceLabel(v.G().Env.GetRunMode())
		if label == "" {
			return fmt.Errorf("No label for brew service restart")
		}
		v.G().Log.Debug("Restarting launchd service: %s", label)
		err := launchd.Restart(label, ioutil.Discard)
		if err != nil {
			return err
		}
	}
	return nil
}

func (v *CmdCheck) versionForService() (string, error) {
	cli, err := GetConfigClient(v.G())
	if err != nil {
		v.G().Log.Debug("no service running: %v", err)
		return "", nil
	}
	res, err := cli.GetConfig(context.TODO(), 0)
	if err != nil {
		return "", err
	}

	return res.Version, err
}

func (v *CmdCheck) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
