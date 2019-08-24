// Copyright 2019 Keybase, Inc. All rights reserved. Use of this
// source code is governed by the included BSD license.

package utils

import (
	"os"
	"path/filepath"
)

// BinPath returns path to the keybase executable. If the executable path is a
// symlink, the target path is returned.
func BinPath() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(exePath)
}
