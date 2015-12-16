// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"fmt"
	"path"

	"github.com/keybase/kbfs/dokan"
)

// Mounter defines interface for different mounting strategies
type Mounter interface {
	Dir() string
	Mount(dokan.FileSystem) error
	Unmount() error
}

// DefaultMounter will only call fuse.Mount and fuse.Unmount directly
type DefaultMounter struct {
	dir   string
	force bool
	fs    dokan.FileSystem
	mnt   *dokan.MountHandle
}

// NewDefaultMounter creates a default mounter.
func NewDefaultMounter(dir string) DefaultMounter {
	return DefaultMounter{dir: dir, force: false}
}

// NewForceMounter creates a force mounter.
func NewForceMounter(dir string) DefaultMounter {
	return DefaultMounter{dir: dir, force: true}
}

// Mount uses default mount and blocks.
func (m DefaultMounter) Mount(fs dokan.FileSystem) error {
	m.fs = fs
	mnt, err := dokan.Mount(m.fs, m.dir[0])
	mnt.BlockTillDone()
	return err
}

// Unmount uses default unmount
func (m DefaultMounter) Unmount() error {
	return m.mnt.Close()
}

// Dir returns mount directory.
func (m DefaultMounter) Dir() string {
	return m.dir
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
