// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package install

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func StopAllButService(mctx libkb.MetaContext, _ keybase1.ExitCode) {
	var err error
	defer mctx.TraceTimed(fmt.Sprintf("StopAllButService()"),
		func() error { return err })()
	mountdir, err := mctx.G().Env.GetMountDir()
	if err != nil {
		mctx.Error("StopAllButService: Error in GetCurrentMountDir: %s", err.Error())
	} else {
		// open special "file". Errors not relevant.
		unmountPath := filepath.Join(mountdir, "\\.kbfs_unmount")
		mctx.Info("StopAllButService: opening .kbfs_unmount at %s", unmountPath)
		_, err = os.Open(unmountPath)
		if err != nil {
			mctx.Debug("StopAllButService: unable to unmount kbfs (%s) but it might still have shut down successfully", err)
		}
		err = libkb.ChangeMountIcon(mountdir, "")
		if err != nil {
			mctx.Error("StopAllButService: unable to change mount icon: %s", err)
		}
		// turn off the updater
		updaterName, err := updaterBinName()
		if err != nil {
			mctx.Error("StopAllButService: error getting path to updater: %s", err)
		}
		if err := exec.Command("taskkill", "/F", "/IM", updaterName).Run(); err != nil {
			mctx.Error("StopAllButService: error stopping the updater: %s\n", err)
		}
	}
}
