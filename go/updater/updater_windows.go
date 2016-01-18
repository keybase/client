// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package updater

import (
	"fmt"
	"os/exec"
	"strings"
)

func (u *Updater) applyUpdate(localPath string) (tmpPath string, err error) {
	// The default source will be an .exe on Windows
	// ...but still do this for .zip files, at least so tests will pass
	if strings.HasSuffix(localPath, ".zip") {
		tmpPath, err = u.applyZip(localPath)
	} else if strings.HasSuffix(localPath, ".exe") {
		err = exec.Command(localPath).Start()
	} else {
		err = fmt.Errorf("Unsupported update file type: %s", localPath)
	}

	return
}
