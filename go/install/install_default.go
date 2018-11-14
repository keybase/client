// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin,!windows

package install

import (
	"context"
	"time"

	"github.com/keybase/client/go/logger"
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

// StartUpdateIfNeeded is a no-op on this platform.
func StartUpdateIfNeeded(context.Context, logger.Logger) error {
	return nil
}

// GetNeedUpdate always returns false, nil on this platform.
func GetNeedUpdate() (bool, error) {
	return false, nil
}
