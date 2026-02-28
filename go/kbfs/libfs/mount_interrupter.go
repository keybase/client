// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"errors"
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
// If Done has already been called MountAndSetUnmount returns
// an error.
func (mi *MountInterrupter) MountAndSetUnmount(mounter Mounter) error {
	mi.log.Debug("Starting to mount the filesystem")
	mi.Lock()
	defer mi.Unlock()
	select {
	case <-mi.done:
		return errors.New("MountInterrupter already done")
	default:
	}
	err := mounter.Mount()
	if err != nil {
		mi.log.Errorf("Mounting the filesystem failed: %v", err)
		return err
	}
	mi.fun = mounter.Unmount
	mi.log.Info("Mounting the filesystem was a success")
	return nil
}

// Done signals Wait and runs the unmounter if set by MountAndSetUnmount.
// It can be called multiple times with no harm. Each call triggers a call to
// the unmounter.
func (mi *MountInterrupter) Done() error {
	mi.Lock()
	defer mi.Unlock()
	if mi.fun != nil {
		err := mi.fun()
		if err != nil {
			mi.log.Errorf("Mount interrupter callback failed: %v", err)
			return err
		}
	}
	mi.once.Do(func() {
		close(mi.done)
	})
	return nil
}

// Wait waits till Done is called.
func (mi *MountInterrupter) Wait() {
	<-mi.done
}
