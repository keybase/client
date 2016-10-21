// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package service

import (
	"github.com/keybase/go-updater/watchdog"
)

func getMountDirs() []string {
	return "", fmt.Errorf("getMountDirs is Windows only", runMode)
}
