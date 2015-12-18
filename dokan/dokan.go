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
	// Currently in mount this is the only receive in the channel.
	// There are two sends one in the above code and one in the
	// sending a nil when the filesystem is mounted in callback.go
	err := <-ec
	if err != nil {
		ctx.Free()
		ctx = nil
	}
	return &MountHandle{ctx, ec, driveLetter}, err
}

// Close unmounts the filesystem.
func (m *MountHandle) Close() error {
	err := Unmount(m.driveLetter)
	m.ctx.Free()
	m.ctx = nil
	return err
}

// BlockTillDone blocks till Dokan is done.
func (m *MountHandle) BlockTillDone() error {
	// Two cases:
	// 1) Mount got send from Mounted hook
	// 2) Mount got send from Mount (which errored) and closed the channel
	// In case 1 we get the Mount result here and ok, in 2 we get nil and not ok.
	err, _ := <-m.errChan
	return err
}
