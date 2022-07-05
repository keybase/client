// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package install

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// StopAllButService on windows can only stop those services which are not managed
// by the watchdog, because this is intended to be called before the service is shut down,
// and the watchdog dies when the service exists gracefully.
func StopAllButService(mctx libkb.MetaContext, exitCode keybase1.ExitCode) {
	var err error
	defer mctx.Trace(fmt.Sprintf("StopAllButService()"),
		&err)()
	mountdir, err := mctx.G().Env.GetMountDir()
	if err != nil {
		mctx.Error("StopAllButService: Error in GetCurrentMountDir: %s", err.Error())
	} else {
		// open special "file". Errors not relevant.
		exitFile := "\\.kbfs_unmount"
		if exitCode == keybase1.ExitCode_RESTART {
			exitFile = "\\.kbfs_restart"
		}
		unmountPath := filepath.Join(mountdir, exitFile)
		mctx.Info("StopAllButService: opening %s", unmountPath)
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
