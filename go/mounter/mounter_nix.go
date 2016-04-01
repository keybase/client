// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package mounter

import (
	"errors"
	"fmt"
	"os/exec"
	"runtime"

	"github.com/keybase/client/go/logger"

	"bazil.org/fuse"
)

// Unmount tries to unmount normally and then if force if unsuccessful.
func Unmount(dir string, force bool, log logger.Logger) error {
	if !force {
		mounted, err := IsMounted(dir, log)
		if err != nil {
			return err
		}
		if !mounted {
			return fmt.Errorf("Not mounted")
		}
	}

	log.Info("Trying to unmount: %s", dir)
	err := fuse.Unmount(dir)
	if err != nil {
		if !force {
			return err
		}
		// Unmount failed and we want to force it.
		log.Info("Unmount %s failed: %s; We will try to force it", dir, err)
		err = ForceUnmount(dir)
	}
	return err
}

// ForceUnmount tries to forceably unmount a directory
func ForceUnmount(dir string) (err error) {
	if runtime.GOOS == "darwin" {
		_, err = exec.Command("/usr/sbin/diskutil", "unmountDisk", "force", dir).Output()
	} else if runtime.GOOS == "linux" {
		_, err = exec.Command("umount", "-l", dir).Output()
	} else {
		err = errors.New("Forced unmount is not supported on this platform yet")
	}
	return
}
