// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

// Package dokan is a binding to the Dokan usermode filesystem binding library on Windows.
package dokan

// MountHandle holds a reference to a mounted filesystem.
type MountHandle struct {
	ctx         *dokanCtx
	errChan     chan error
	driveLetter byte
}

// Mount mounts a FileSystem to the given drive letter and returns when it has been mounted
// or there is an error.
func Mount(fs FileSystem, driveLetter byte) (*MountHandle, error) {
	var ec = make(chan error, 1)
	var slot = fsTableStore(fs, ec)
	ctx := allocCtx(slot)
	go func() {
		err := ctx.Run(driveLetter)
		select {
		case ec <- err:
		default:
		}
		close(ec)
	}()
	err := <-ec
	if err != nil {
		return nil, err
	}
	return &MountHandle{ctx, ec, driveLetter}, nil
}

// Close unmounts the filesystem.
func (m *MountHandle) Close() error {
	if m == nil {
		return nil
	}
	err := Unmount(m.driveLetter)
	m.ctx.Free()
	m.ctx = nil
	return err
}

// BlockTillDone blocks till Dokan is done.
func (m *MountHandle) BlockTillDone() {
	if m != nil {
		for {
			_, ok := <-m.errChan
			if !ok {
				return
			}
		}
	}
}
