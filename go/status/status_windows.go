// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package status

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func osSpecific(mctx libkb.MetaContext, status *keybase1.FullStatus) error {
	// TODO: on darwin, install.KeybaseServiceStatus() is implemented to get pid for service and kbfs.
	// This is currently the best way to determine if KBFS is running, so other OS's should implement
	// it.
	productVersion, _, err := osVersionAndBuild()
	if err != nil {
		mctx.Debug("Error determining OS version: %s", err)
	}
	status.ExtStatus.PlatformInfo.OsVersion = productVersion
	return nil
}

// osVersionAndBuild returns OS version, and build too on some platforms
func osVersionAndBuild() (string, string, error) {
	productVersion, err := execToString("cmd", []string{"/c", "ver"})
	if err != nil {
		return "", "", err
	}
	return productVersion, "", nil
}
