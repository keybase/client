// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package updater

import (
	"fmt"
	"os/exec"
	"strings"
)

func (u *Updater) checkPlatformSpecificUpdate(sourcePath string, destinationPath string) error {
	return nil
}

func openApplication(applicationPath string) error {
	return fmt.Errorf("Open application not supported on this platform")
}

func (u *Updater) applyUpdate(localPath string) (err error) {
	if strings.HasSuffix(localPath, ".exe") {
		err = exec.Command(localPath, "/SILENT").Start()
	} else {
		err = fmt.Errorf("Unsupported update file type: %s", localPath)
	}
	return
}
