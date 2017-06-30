// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path"
	"runtime"

	"bazil.org/fuse"
)

type mounter struct {
	options StartOptions
	c       *fuse.Conn
}

// fuseMount tries to mount the mountpoint.
// On a force mount then unmount, re-mount if unsuccessful
func (m *mounter) Mount() (err error) {
	m.c, err = fuseMountDir(m.options.MountPoint, m.options.PlatformParams)
	// Exit if we were succesful or we are not a force mounting on error.
	if err == nil || !m.options.ForceMount {
		return err
	}

	// Mount failed, let's try to unmount and then try mounting again, even
	// if unmounting errors here.
	m.Unmount()

	m.c, err = fuseMountDir(m.options.MountPoint, m.options.PlatformParams)
	return err
}

func fuseMountDir(dir string, platformParams PlatformParams) (*fuse.Conn, error) {
	fi, err := os.Stat(dir)
	if err != nil {
		return nil, err
	}
	if !fi.IsDir() {
		return nil, errors.New("mount point is not a directory")
	}
	options, err := getPlatformSpecificMountOptions(dir, platformParams)
	if err != nil {
		return nil, err
	}
	c, err := fuse.Mount(dir, options...)
	if err != nil {
		err = translatePlatformSpecificError(err, platformParams)
		return nil, err
	}
	return c, nil
}

func (m *mounter) Unmount() (err error) {
	dir := m.options.MountPoint
	// Try normal unmount
	switch runtime.GOOS {
	case "darwin":
		_, err = exec.Command("/sbin/umount", dir).Output()
	case "linux":
		_, err = exec.Command("fusermount", "-u", dir).Output()
	default:
		err = fuse.Unmount(dir)
	}
	if err != nil && m.options.ForceMount {
		// Unmount failed, so let's try and force it.
		switch runtime.GOOS {
		case "darwin":
			_, err = exec.Command(
				"/usr/sbin/diskutil", "unmountDisk", "force", dir).Output()
		case "linux":
			_, err = exec.Command("fusermount", "-ul", dir).Output()
		default:
			err = errors.New("Forced unmount is not supported on this platform yet")
		}
	}
	if execErr, ok := err.(*exec.ExitError); ok && execErr.Stderr != nil {
		err = fmt.Errorf("%s (%s)", execErr, execErr.Stderr)
	}
	return
}

// volumeName returns the directory (base) name
func volumeName(dir string) (string, error) {
	volName := path.Base(dir)
	if volName == "." || volName == "/" {
		err := fmt.Errorf("Bad volume name: %v", volName)
		return "", err
	}
	return volName, nil
}
