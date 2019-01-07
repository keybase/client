// Copyright 2019 Keybase, Inc. All rights reserved. Use of this
// source code is governed by the included BSD license.

package libcmdline

import (
	"os"

	"github.com/kardianos/osext"
)

// BinPath returns path to the keybase executable. If the executable path is a
// symlink, the target path is returned.
func BinPath() (string, error) {
	exePath, err := osext.Executable()
	if err != nil {
		return "", err
	}
	fi, err := os.Lstat(exePath)
	if err != nil {
		return "", err
	}
	if fi.Mode()&os.ModeSymlink != 0 {
		return os.Readlink(exePath)
	}
	return exePath, nil
}
