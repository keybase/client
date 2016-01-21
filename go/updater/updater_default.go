// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin,!windows

package updater

import "fmt"

func (u *Updater) checkPlatformSpecificUpdate(sourcePath string, destinationPath string) error {
	return nil
}

func openApplication(applicationPath string) error {
	return fmt.Errorf("Open application not supported on this platform")
}

func (u *Updater) applyUpdate(localPath string) (string, error) {
	return "", nil
}
