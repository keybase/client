// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package install

import (
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func StopAllButService(mctx libkb.MetaContext, _ keybase1.ExitCode) {
	g := mctx.G()
	mctx.Debug("+ StopAllButService")
	if libkb.IsBrewBuild {
		launchd.Stop(DefaultServiceLabel(g.Env.GetRunMode()), defaultLaunchdWait, g.Log)
	}
	mctx.Debug("StopAllButService: Terminating app")
	err := TerminateApp(g, g.Log)
	if err != nil {
		mctx.Debug(err.Error())
	}
	mctx.Debug("StopAllButService: Terminating KBFS")
	err = UninstallKBFSOnStop(g, g.Log)
	if err != nil {
		mctx.Debug(err.Error())
	}
	mctx.Debug("StopAllButService: Terminating updater")
	err = UninstallUpdaterService(g, g.Log)
	if err != nil {
		mctx.Debug(err.Error())
	}
	mctx.Debug("StopAllButService: Terminating Keybase services")
	err = UninstallKeybaseServices(g, g.Log)
	if err != nil {
		mctx.Debug(err.Error())
	}
	mctx.Debug("- StopAllButService")
}
