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

// StopAllButService on windows can only stop those services which are not managed
// by the watchdog, because this is intended to be called before the service is shut down,
// and the watchdog dies when the service exists gracefully.
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
	}
}

// StopUpdater stops the updater, but it can only be stopped this way when the watchdog is
// not currently running. so only call this after shutting down the service.
func StopUpdater(mctx libkb.MetaContext) error {
	var err error
	defer mctx.TraceTimed(fmt.Sprintf("StopUpdater()"),
		func() error { return err })()
	// turn off the updater
	updaterName, err := updaterBinName()
	if err != nil {
		mctx.Error("StopUpdater: error getting path to updater: %s", err)
		return err
	}
	if err := exec.Command("taskkill", "/F", "/IM", updaterName).Run(); err != nil {
		mctx.Error("StopAllButService: error stopping the updater: %s\n", err)
		return err
	}
	return nil
}
