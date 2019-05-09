// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build dragonfly freebsd linux netbsd openbsd solaris

package status

import (
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func osSpecific(mctx libkb.MetaContext, status *keybase1.FullStatus) error {
	// TODO: on darwin, install.KeybaseServiceStatus() is implemented to get pid for service and kbfs.
	// This is currently the best way to determine if KBFS is running, so other OS's should implement
	// it.
	productVersion, buildVersion, err := osVersionAndBuild()
	if err != nil {
		mctx.Debug("Error determining OS version: %s", err)
	}
	status.ExtStatus.PlatformInfo.OsVersion = strings.Join([]string{productVersion, buildVersion}, "-")

	return nil
}

// osVersionAndBuild returns OS version, and build too on some platforms
func osVersionAndBuild() (string, string, error) {
	productVersion, err := execToString("uname", []string{"-mrs"})
	if err != nil {
		return "", "", err
	}

	buildVersion, err := execToString("lsb_release", []string{"-sd"})
	if err != nil {
		return productVersion, "", err
	}
	return productVersion, buildVersion, nil
}
