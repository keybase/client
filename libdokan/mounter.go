// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"fmt"
	"path"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/dokan"
)

// Mounter defines interface for different mounting strategies
type Mounter interface {
	Dir() string
	Mount(dokan.FileSystem, logger.Logger) error
	Unmount() error
}

// DefaultMounter will only call fuse.Mount and fuse.Unmount directly
type DefaultMounter struct {
	lock  sync.Mutex
	dir   string
	force bool
	mnt   *dokan.MountHandle
}

// NewDefaultMounter creates a default mounter.
func NewDefaultMounter(dir string) *DefaultMounter {
	return &DefaultMounter{dir: dir, force: false}
}

// NewForceMounter creates a force mounter.
func NewForceMounter(dir string) *DefaultMounter {
	return &DefaultMounter{dir: dir, force: true}
}

// Mount uses default mount and blocks.
func (m *DefaultMounter) Mount(fs dokan.FileSystem, log logger.Logger) error {
	var err error
	var h *dokan.MountHandle
	// Retry loop
	for i := 1; true; i *= 2 {
		h, err = m.mountHelper(fs)
		// break if success, no force or too many tries.
		if err == nil || i > 128 {
			break
		}
		log.Errorf("Failed to mount dokan filesystem (i=%d): %v", i, err)
		// Sleep two times 100ms, 200ms, 400, 800...
		time.Sleep(time.Duration(i) * 100 * time.Millisecond)
		if m.force {
			dokan.Unmount(m.dir)
			time.Sleep(time.Duration(i) * 100 * time.Millisecond)
		}
	}

	if err != nil {
		return err
	}
	log.Info("Mounting the filesystem was a success!")
	return h.BlockTillDone()
}

// mountHelper is needed since Unmount may be called from an another
// go-routine.
func (m *DefaultMounter) mountHelper(fs dokan.FileSystem) (*dokan.MountHandle, error) {
	// m.dir is constant and safe to access outside the lock.
	handle, err := dokan.Mount(fs, m.dir)
	if err != nil {
		return nil, err
	}

	m.lock.Lock()
	defer m.lock.Unlock()
	m.mnt = handle
	return handle, nil
}

// Unmount uses default unmount
func (m *DefaultMounter) Unmount() error {
	if m.mnt == nil {
		return nil
	}
	m.lock.Lock()
	h := m.mnt
	m.lock.Unlock()
	return h.Close()
}

// Dir returns mount directory.
func (m *DefaultMounter) Dir() string {
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
