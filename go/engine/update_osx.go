// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin,!ios

package engine

import (
	"fmt"
	"os/exec"

	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libkb"
)

// AfterUpdateApply runs after an update has been applied
func AfterUpdateApply(g *libkb.GlobalContext, willRestart bool) error {
	if !willRestart {
		return nil
	}
	reinstallKBFS, err := checkFuseUpgrade(g, "/Applications/Keybase.app")
	if err != nil {
		g.Log.Errorf("Error trying to upgrade Fuse: %s", err)
	}
	if reinstallKBFS {
		g.Log.Info("Re-installing KBFS")
		err := install.InstallKBFS(g, "", false)
		if err != nil {
			g.Log.Errorf("Error re-installing KBFS: %s", err)
		}
	}
	return nil
}

// checkFuseUpgrade will see if the Fuse version in the Keybase.app bundle
// matches whats currently installed, and if not, will uninstall KBFS so that
// it can re-install new version of Fuse.
// Returns true if KBFS should be re-installed.
func checkFuseUpgrade(g *libkb.GlobalContext, appPath string) (reinstallKBFS bool, err error) {
	runMode := g.Env.GetRunMode()
	log := g.Log
	var mountDir string
	mountDir, err = g.Env.GetMountDir()
	if err != nil {
		return
	}
	log.Info("Checking Fuse status")
	fuseStatus, err := install.KeybaseFuseStatusForAppBundle(appPath, log)
	if err != nil {
		return
	}
	log.Info("Fuse status: %s", fuseStatus)

	hasKBFuseMounts := false
	for _, mountInfo := range fuseStatus.MountInfos {
		if mountInfo.Fstype == "kbfuse" {
			hasKBFuseMounts = true
			break
		}
	}

	if true { //fuseStatus.InstallAction == keybase1.InstallAction_UPGRADE {
		log.Info("Fuse needs upgrade")
		if hasKBFuseMounts {
			log.Info("We have mounts, let's uninstall KBFS so the installer can upgrade")
			reinstallKBFS = true
			err = install.UninstallKBFS(runMode, mountDir, log)
			if err != nil {
				return
			}
		}

		// Do Fuse upgrade
		log.Info("Installing Fuse")
		var out []byte
		out, err = exec.Command("/Applications/Keybase.app/Contents/Resources/KeybaseInstaller.app/Contents/MacOS/Keybase",
			fmt.Sprintf("--app-path=%s", appPath),
			"--run-mode=prod",
			"--install-fuse").CombinedOutput()
		log.Debug("Fuse install: %s", string(out))
		if err != nil {
			return
		}
	}

	return
}
