// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package dokan

import (
	"github.com/keybase/client/go/kbfs/dokan/winacl"
)

// MountHandle holds a reference to a mounted filesystem.
type MountHandle struct {
	errChan chan error
	// Dir is the path of this mount.
	Dir string
}

// Mount mounts a FileSystem with the given Config.
// Mount returns when the filesystem has been mounted or there is an error.
func Mount(cfg *Config) (*MountHandle, error) {
	err := loadDokanDLL(cfg)
	if err != nil {
		return nil, err
	}
	var ec = make(chan error, 2)
	var slot = fsTableStore(cfg.FileSystem, ec)
	flags := cfg.MountFlags
	go func() {
		ctx := allocCtx(slot)
		defer ctx.Free()
		ec <- ctx.Run(cfg.Path, flags)
		close(ec)
	}()
	// This gets a send from either
	// 1) DokanMain from ctx.Run returns an error before mount
	// 2) After the filesystem is mounted from handling the Mounted callback.
	// Thus either the filesystem was mounted ok or it was not mounted
	// and an err is not nil. DokanMain does not return errors after the
	// mount, but if such errors occured they can be catched by BlockTillDone.
	err = <-ec
	if err != nil {
		return nil, err
	}
	return &MountHandle{ec, cfg.Path}, nil
}

// Close unmounts the filesystem. Can be used to interrupt a
// running filesystem - usually not needed if BlockTillDone
// is used.
func (m *MountHandle) Close() error {
	return Unmount(m.Dir)
}

// BlockTillDone blocks till Dokan is done.
func (m *MountHandle) BlockTillDone() error {
	// Two cases:
	// 1) Mount got send from Mounted hook (nil) and we wait for the ctx.Run case
	// 2) Mount got send from Mount (which errored) and closed the channel
	err := <-m.errChan
	return err
}

// Unmount a drive mounted by Dokan.
func Unmount(path string) error {
	return unmount(path)
}

// Path converts the path to UTF-8 running in O(n).
func (fi *FileInfo) Path() string {
	return lpcwstrToString(fi.rawPath)
}

// IsDeleteOnClose should be checked from Cleanup.
func (fi *FileInfo) IsDeleteOnClose() bool {
	return fi.ptr.DeleteOnClose != 0
}

// IsRequestorUserSidEqualTo returns true if the argument is equal
// to the sid of the user associated with the filesystem request.
func (fi *FileInfo) IsRequestorUserSidEqualTo(sid *winacl.SID) bool {
	return fi.isRequestorUserSidEqualTo(sid)
}

// NumberOfFileHandles returns the number of open file handles for
// this filesystem.
func (fi *FileInfo) NumberOfFileHandles() uint32 {
	return fsTableGetFileCount(uint32(fi.ptr.DokanOptions.GlobalContext))
}
