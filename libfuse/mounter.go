// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"errors"
	"fmt"
	"os/exec"
	"path"
	"runtime"

	"bazil.org/fuse"
)

// Mounter defines interface for different mounting strategies
type Mounter interface {
	Dir() string
	Mount() (*fuse.Conn, error)
	Unmount() error
}

// DefaultMounter will only call fuse.Mount and fuse.Unmount directly
type DefaultMounter struct {
	dir            string
	platformParams PlatformParams
}

// NewDefaultMounter creates a default mounter.
func NewDefaultMounter(dir string, platformParams PlatformParams) DefaultMounter {
	return DefaultMounter{dir: dir, platformParams: platformParams}
}

// Mount uses default mount
func (m DefaultMounter) Mount() (*fuse.Conn, error) {
	return fuseMountDir(m.dir, m.platformParams)
}

// Unmount uses default unmount
func (m DefaultMounter) Unmount() error {
	return doUnmount(m.dir, false)
}

// Dir returns mount directory.
func (m DefaultMounter) Dir() string {
	return m.dir
}

// ForceMounter will try its best to get it a mount
type ForceMounter struct {
	dir            string
	platformParams PlatformParams
}

// NewForceMounter creates a force mounter.
func NewForceMounter(dir string, platformParams PlatformParams) ForceMounter {
	return ForceMounter{dir: dir, platformParams: platformParams}
}

// Mount tries to mount and then unmount, re-mount if unsuccessful
func (m ForceMounter) Mount() (*fuse.Conn, error) {
	c, err := fuseMountDir(m.dir, m.platformParams)
	if err == nil {
		return c, nil
	}

	// Mount failed, let's try to unmount and then try mounting again, even
	// if unmounting errors here.
	m.Unmount()

	c, err = fuseMountDir(m.dir, m.platformParams)
	return c, err
}

// Unmount tries to unmount normally and then force if unsuccessful
func (m ForceMounter) Unmount() (err error) {
	// Try unmount
	err = doUnmount(m.dir, false)
	if err != nil {
		// Unmount failed, so let's try and force it.
		err = doUnmount(m.dir, true)
	}
	return
}

func doUnmount(dir string, force bool) (err error) {
	switch runtime.GOOS {
	case "darwin":
		if force {
			_, err = exec.Command("/usr/sbin/diskutil", "unmountDisk", "force", dir).Output()
		} else {
			_, err = exec.Command("/sbin/umount", dir).Output()
		}
	case "linux":
		if force {
			_, err = exec.Command("fusermount", "-ul", dir).Output()
		} else {
			_, err = exec.Command("fusermount", "-u", dir).Output()
		}
	default:
		if force {
			err = errors.New("Forced unmount is not supported on this platform yet")
		} else {
			fuse.Unmount(dir)
		}
	}
	return err
}

// Dir returns mount directory.
func (m ForceMounter) Dir() string {
	return m.dir
}

func fuseMountDir(dir string, platformParams PlatformParams) (*fuse.Conn, error) {
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

// volumeName returns the directory (base) name
func volumeName(dir string) (string, error) {
	volName := path.Base(dir)
	if volName == "." || volName == "/" {
		err := fmt.Errorf("Bad volume name: %v", volName)
		return "", err
	}
	return volName, nil
}

// NoopMounter is a mounter that does nothing.
type NoopMounter struct{}

// NewNoopMounter creates a mounter that does nothing.
func NewNoopMounter() NoopMounter {
	return NoopMounter{}
}

// Mount doesn't mount anything, and returns a nil connection.
func (m NoopMounter) Mount() (*fuse.Conn, error) {
	return nil, nil
}

// Unmount doesn't do anything.
func (m NoopMounter) Unmount() error {
	return nil
}

// Dir returns an empty string.
func (m NoopMounter) Dir() string {
	return ""
}
