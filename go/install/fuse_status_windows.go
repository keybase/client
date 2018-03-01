// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package install

import (
	"path/filepath"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func detectDokanDll(log Log) bool {
	dir, err := libkb.SystemDir()
	if err != nil {
		log.Info("detectDokanDll error getting system directory: %v", err)
		return false
	}

	exists, _ := libkb.FileExists(filepath.Join(dir, "dokan1.dll"))
	log.Info("detectDokanDll: returning %v", exists)
	return exists
}

func KeybaseFuseStatus(bundleVersion string, log Log) keybase1.FuseStatus {
	status := keybase1.FuseStatus{}
	if detectDokanDll(log) {
		status.InstallStatus = keybase1.InstallStatus_INSTALLED
		status.InstallAction = keybase1.InstallAction_NONE
		status.KextStarted = true
	} else {
		status.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		status.InstallAction = keybase1.InstallAction_INSTALL
	}
	return status
}
