// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package mounter

import (
	"errors"
	"fmt"
	"os/exec"
	"runtime"

	"bazil.org/fuse"
)

// Unmount tries to unmount normally and then if force if unsuccessful.
func Unmount(dir string, force bool, log Log) error {
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
		err = ForceUnmount(dir, log)
	}
	return err
}

// ForceUnmount tries to forceably unmount a directory
func ForceUnmount(dir string, log Log) error {
	switch runtime.GOOS {
	case "darwin":
		log.Info("Force unmounting with diskutil")
		out, err := exec.Command("/usr/sbin/diskutil", "unmountDisk", "force", dir).CombinedOutput()
		log.Debug("Output: %s", string(out))
		return err
	case "linux":
		log.Info("Force unmounting with umount -l")
		out, err := exec.Command("umount", "-l", dir).CombinedOutput()
		log.Debug("Output: %s", string(out))
		return err
	default:
		return errors.New("Forced unmount is not supported on this platform yet")
	}
}
