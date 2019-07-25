// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path"
	"runtime"
	"strings"

	"bazil.org/fuse"
	"github.com/keybase/client/go/kbconst"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type mounter struct {
	options StartOptions
	c       *fuse.Conn
	log     logger.Logger
	runMode kbconst.RunMode
}

// fuseMount tries to mount the mountpoint.
// On a force mount then unmount, re-mount if unsuccessful
func (m *mounter) Mount() (err error) {
	defer func() {
		if err != nil {
			msg := fmt.Sprintf("KBFS failed to FUSE mount at %s: %s", m.options.MountPoint, err)
			fmt.Println(msg)
			m.log.Warning(msg)
		}
	}()

	m.c, err = fuseMountDir(m.options.MountPoint, m.options.PlatformParams)
	// Exit if we were successful or we are not a force mounting on error.
	// Otherwise, try unmounting and mounting again.
	if err == nil || !m.options.ForceMount {
		return err
	}

	// Mount failed, let's try to unmount and then try mounting again, even
	// if unmounting errors here.
	_ = m.Unmount()

	// In case we are on darwin, ask the installer to reinstall the mount dir
	// and try again as the last resort. This specifically fixes a situation
	// where /keybase gets created and owned by root after Keybase app is
	// started, and `kbfs` later fails to mount because of a permission error.
	m.reinstallMountDirIfPossible()
	m.c, err = fuseMountDir(m.options.MountPoint, m.options.PlatformParams)

	return err
}

func fuseMountDir(dir string, platformParams PlatformParams) (*fuse.Conn, error) {
	// Create mountdir directory on Linux.
	switch libkb.RuntimeGroup() {
	case keybase1.RuntimeGroup_LINUXLIKE:
		// Inherit permissions from containing directory and umask.
		err := os.MkdirAll(dir, os.ModeDir|os.ModePerm)
		if err != nil {
			return nil, err
		}
	default:
	}

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

func isFusermountMountNotFoundError(output []byte, err error) bool {
	if err == nil {
		return false
	}
	return bytes.Contains(output, []byte("not found in /etc/mtab"))
}

func (m *mounter) Unmount() (err error) {
	m.log.Info("Unmounting")
	dir := m.options.MountPoint
	// Try normal unmount
	switch runtime.GOOS {
	case "darwin":
		_, err = exec.Command("/sbin/umount", dir).Output()
	case "linux":
		fusermountOutput, fusermountErr := exec.Command("fusermount", "-u", dir).CombinedOutput()
		// Only clean up mountdir on a clean unmount.
		if fusermountErr == nil {
			m.log.Info("Successfully unmounted")
			defer m.DeleteMountdirIfEmpty()
		}
		if fusermountErr != nil {
			// Ignore errors where the mount was never mounted in the first place
			if isFusermountMountNotFoundError(fusermountOutput, fusermountErr) {
				m.log.Info("Ignoring mount-not-found fusermount error")
			} else {
				returnErr := fmt.Errorf("fusermount unmount resulted in unknown error: output=%v; err=%s", fusermountOutput, fusermountErr)
				m.log.Warning(returnErr.Error())
				err = returnErr
			}
		}
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
			// Lazy unmount; will unmount when KBFS is no longer in use.
			_, err = exec.Command("fusermount", "-u", "-z", dir).Output()
		default:
			err = errors.New("Forced unmount is not supported on this platform yet")
		}
	}
	if execErr, ok := err.(*exec.ExitError); ok && execErr.Stderr != nil {
		err = fmt.Errorf("%s (%s)", execErr, execErr.Stderr)
	}
	return
}

func (m *mounter) DeleteMountdirIfEmpty() {
	m.log.Info("Deleting mountdir")
	// os.Remove refuses to delete non-empty directories.
	err := os.Remove(m.options.MountPoint)
	if err != nil {
		m.log.Errorf("Unable to delete mountdir: %s", err)
	}
}

// volumeName returns the first word of the directory (base) name
func volumeName(dir string) (string, error) { // nolint
	volName := path.Base(dir)
	if volName == "." || volName == "/" {
		err := fmt.Errorf("Bad volume name: %v", volName)
		return "", err
	}
	s := strings.Split(volName, " ")
	if len(s) == 0 {
		return "", fmt.Errorf("Bad volume name: %v", volName)
	}
	return s[0], nil
}
