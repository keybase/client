// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin,!ios

package engine

import (
	"fmt"
	"os/exec"
	"path/filepath"

	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
)

// AfterUpdateApply runs after an update has been applied
func AfterUpdateApply(g *libkb.GlobalContext, willRestart bool, force bool) error {
	if !willRestart {
		return nil
	}
	reinstallKBFS, err := checkFuseUpgrade(g, "/Applications/Keybase.app", force)
	if err != nil {
		g.Log.Errorf("Error trying to upgrade Fuse: %s", err)
	}
	if reinstallKBFS {
		g.Log.Info("Re-installing KBFS")
		err := install.InstallKBFS(g, "", false)
		if err != nil {
			g.Log.Errorf("Error re-installing KBFS (after Fuse upgrade): %s", err)
		}
	}
	return nil
}

// checkFuseUpgrade will see if the Fuse version in the Keybase.app bundle
// is new, and if so will uninstall KBFS so that it can upgrade Fuse.
// If force is true, the Fuse upgrade is attempted even if it's not needed.
// Returns true if KBFS should be re-installed (after the Fuse upgrade succeeded
// or failed).
func checkFuseUpgrade(g *libkb.GlobalContext, appPath string, force bool) (reinstallKBFS bool, err error) {
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

	if fuseStatus.InstallAction == keybase1.InstallAction_UPGRADE || force {
		log.Info("Fuse needs upgrade")
		if hasKBFuseMounts {
			log.Info("We have mounts, let's uninstall KBFS so the installer can upgrade")
			reinstallKBFS = true
			err = install.UninstallKBFS(runMode, mountDir, true, log)
			if err != nil {
				return
			}
		}

		// Do Fuse upgrade
		log.Info("Installing Fuse")
		var out []byte
		out, err = exec.Command(
			filepath.Join(appPath, "Contents/Resources/KeybaseInstaller.app/Contents/MacOS/Keybase"),
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
