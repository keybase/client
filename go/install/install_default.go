// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package install

import (
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
)

// Install empty implementation for unsupported platforms
func Install(context Context, binPath string, sourcePath string, components []string, force bool, timeout time.Duration, log Log) keybase1.InstallResult {
	return keybase1.InstallResult{}
}

// Uninstall empty implementation for unsupported platforms
func Uninstall(context Context, components []string, log Log) keybase1.UninstallResult {
	return keybase1.UninstallResult{}
}

// LoadKext empty implementation for unsupported platforms
func LoadKext(log Log) keybase1.Status {
	return keybase1.StatusFromCode(keybase1.StatusCode_SCInstallError, "Unsupported")
}
