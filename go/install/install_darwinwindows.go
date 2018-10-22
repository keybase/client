// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin windows

package install

import (
	"os/exec"
	"strconv"
	"strings"
)

// GetNeedUpdate returns true if updater says we have a new update available.
// This runs `updater need-update`, which ignores the snooze.
func GetNeedUpdate() (bool, error) {
	updaterPath, err := UpdaterBinPath()
	if err != nil {
		return false, err
	}
	cmd := exec.Command(updaterPath, "need-update")
	out, err := cmd.Output()
	if err != nil {
		return false, err
	}
	needUpdate, err := strconv.ParseBool(strings.TrimSpace(string(out)))
	if err != nil {
		return false, err
	}
	return needUpdate, nil
}
