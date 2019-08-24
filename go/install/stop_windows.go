// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package install

import (
	"os"
	"path/filepath"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func StopAllButService(mctx libkb.MetaContext, _ keybase1.ExitCode) {
	mountdir, err := mctx.G().Env.GetMountDir()
	if err != nil {
		mctx.Error("StopAllButService: Error in GetCurrentMountDir: %s", err.Error())
	} else {
		// open special "file". Errors not relevant.
		mctx.Debug("StopAllButService: opening .kbfs_unmount")
		os.Open(filepath.Join(mountdir, "\\.kbfs_unmount"))
		libkb.ChangeMountIcon(mountdir, "")
	}
}
