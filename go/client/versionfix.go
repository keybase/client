// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"github.com/blang/semver"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
	"os"
	"time"
)

func FixVersionClash(g *libkb.GlobalContext, cl libkb.CommandLine) (err error) {
	var cli keybase1.ConfigClient
	var ctlCli keybase1.CtlClient
	var serviceConfig keybase1.Config

	g.Log.Debug("+ FixVersionClash")
	defer func() {
		g.Log.Debug("- FixVersionClash -> %v", err)
	}()
	cli, err = GetConfigClient(g)
	if err != nil {
		return err
	}
	serviceConfig, err = cli.GetConfig(context.TODO(), 0)
	if err != nil {
		return err
	}
	g.Log.Debug("| Contacted service; got version: %s", serviceConfig.Version)

	// We'll check and restart the service if there is a new version.
	var semverClient, semverService semver.Version

	cliVersion := libkb.VersionString()
	if g.Env.GetRunMode() == libkb.DevelRunMode {
		tmp := os.Getenv("KEYBASE_SET_VERSION")
		if len(tmp) > 0 {
			cliVersion = tmp
		}
	}

	semverClient, err = semver.Make(cliVersion)
	if err != nil {
		return err
	}
	semverService, err = semver.Make(serviceConfig.Version)
	if err != nil {
		return err
	}

	g.Log.Debug("| version check %s v %s", semverClient, semverService)
	if semverClient.EQ(semverService) {
		g.Log.Debug("| versions check out")
		return nil
	} else if semverClient.LT(semverService) {
		return fmt.Errorf("Unexpected version clash; client is at v%s, which *less than* server at v%s",
			semverClient, semverService)
	}

	g.Log.Warning("Restarting after upgrade; service is running v%s, while v%s is available",
		semverService, semverClient)
	ctlCli, err = GetCtlClient(g)
	if err != nil {
		return err
	}
	err = ctlCli.Stop(context.TODO(), keybase1.StopArg{})
	if err != nil {
		return err
	}
	time.Sleep(10 * time.Millisecond)
	g.Log.Info("Waiting for shutdown...")
	time.Sleep(1 * time.Second)

	if serviceConfig.ForkType == keybase1.ForkType_AUTO {
		g.Log.Info("Restarting service...")
		_, err = AutoForkServer(g, cl)
	}

	return err
}
