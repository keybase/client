// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

// Package dokan is a binding to the Dokan usermode filesystem binding library on Windows.
package dokan

// MountHandle holds a reference to a mounted filesystem.
type MountHandle struct {
	errChan chan error
	// Dir is the path of this mount.
	Dir string
}

// Mount mounts a FileSystem to the given path and returns when it has been mounted
// or there is an error.
func Mount(fs FileSystem, path string) (*MountHandle, error) {
	var ec = make(chan error, 2)
	var slot = fsTableStore(fs, ec)
	flags := fs.MountFlags()
	go func() {
		ctx := allocCtx(slot)
		defer ctx.Free()
		ec <- ctx.Run(path, flags)
		close(ec)
	}()
	// This gets a send from either
	// 1) DokanMain from ctx.Run returns an error before mount
	// 2) After the filesystem is mounted from handling the Mounted callback.
	// Thus either the filesystem was mounted ok or it was not mounted
	// and an err is not nil. DokanMain does not return errors after the
	// mount, but if such errors occured they can be catched by BlockTillDone.
	err := <-ec
	if err != nil {
		return nil, err
	}
	return &MountHandle{ec, path}, nil
}

// Close unmounts the filesystem.
func (m *MountHandle) Close() error {
	err := Unmount(m.Dir)
	return err
}

// BlockTillDone blocks till Dokan is done.
func (m *MountHandle) BlockTillDone() error {
	// Two cases:
	// 1) Mount got send from Mounted hook (nil) and we wait for the ctx.Run case
	// 2) Mount got send from Mount (which errored) and closed the channel
	err, _ := <-m.errChan
	return err
}
