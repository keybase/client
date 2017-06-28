// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"sync"

	"github.com/keybase/client/go/logger"
)

// Mounter is the interface for filesystems to be mounted by MountInterrupter.
type Mounter interface {
	// Mount a  filesystem.
	Mount() error
	// Unmount a mounted filesystem.
	Unmount() error
}

// MountInterrupter is for managing mounts with cancelation.
type MountInterrupter struct {
	// can be locked from external code too.
	sync.Mutex
	once sync.Once
	done chan struct{}
	fun  func() error
	log  logger.Logger
}

// NewMountInterrupter creates a new MountInterrupter.
func NewMountInterrupter(log logger.Logger) *MountInterrupter {
	return &MountInterrupter{done: make(chan struct{}), log: log}
}

// MountAndSetUnmount calls Mount and sets the unmount function
// to be called once if mount succeeds.
func (mi *MountInterrupter) MountAndSetUnmount(mounter Mounter) error {
	mi.log.Debug("Starting to mount the filesystem")
	mi.Lock()
	defer mi.Unlock()
	err := mounter.Mount()
	if err != nil {
		mi.log.Error("Mounting the filesystem failed: ", err)
		return err
	}
	mi.fun = mounter.Unmount
	mi.log.Info("Mounting the filesystem was a success")
	return nil
}

// Done signals Wait and runs a function if set by SetOnceFun.
// It can be called multiple times with no harm.
func (mi *MountInterrupter) Done() {
	mi.once.Do(func() {
		mi.Lock()
		f := mi.fun
		mi.Unlock()
		if f != nil {
			err := f()
			if err != nil {
				mi.log.Error("Mount interrupter callback failed: ", err)
			}
		}
		close(mi.done)
	})
}

// Wait waits till Done is called.
func (mi *MountInterrupter) Wait() {
	<-mi.done
}
