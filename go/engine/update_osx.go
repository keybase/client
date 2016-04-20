// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin,!ios

package engine

import (
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol"
)

// AfterUpdateApply runs after an update has been applied
func AfterUpdateApply(g *libkb.GlobalContext, willRestart bool) error {
	if willRestart {
		return UninstallForFuseUpgrade("/Applications/Keybase.app", g.Env.GetRunMode(), g.Env.GetMountDir(), g.Log)
	}
	return nil
}

// UninstallForFuseUpgrade will see if the Fuse version in the Keybase.app
// bundle matches whats currently installed, and if not, will uninstall KBFS so
// that on the next restart, Fuse can be upgraded.
func UninstallForFuseUpgrade(appPath string, runMode libkb.RunMode, mountDir string, log logger.Logger) error {
	log.Debug("Checking Fuse status")
	fuseStatus, err := install.KeybaseFuseStatusForAppBundle(appPath, log)
	if err != nil {
		return err
	}

	log.Debug("Fuse status: %s", fuseStatus)

	hasKBFuseMounts := false
	for _, mountInfo := range fuseStatus.MountInfos {
		if mountInfo.Fstype == "kbfuse" {
			hasKBFuseMounts = true
			break
		}
	}

	if fuseStatus.InstallAction == keybase1.InstallAction_UPGRADE && hasKBFuseMounts {
		log.Info("Fuse needs upgrade and we have mounts, let's uninstall KBFS so the installer can upgrade after app restart")
		return install.UninstallKBFS(runMode, mountDir, log)
	}

	return nil
}
