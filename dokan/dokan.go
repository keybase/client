// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package dokan

// MountHandle holds a reference to a mounted filesystem.
type MountHandle struct {
	errChan chan error
	// Dir is the path of this mount.
	Dir string
}

// Mount mounts a FileSystem with the given Config.
// Mount returns when the filesystem has been mounted or there is an error.
func Mount(cfg *Config) (*MountHandle, error) {
	err := loadDokanDLL(cfg.DllPath)
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

// Unmount a drive mounted by Dokan.
func Unmount(path string) error {
	return unmount(path)
}

// Path converts the path to UTF-8 running in O(n).
func (fi *FileInfo) Path() string {
	return lpcwstrToString(fi.rawPath)
}

// DeleteOnClose should be checked from Cleanup.
func (fi *FileInfo) DeleteOnClose() bool {
	return fi.ptr.DeleteOnClose != 0
}

// IsRequestorUserSidEqualTo returns true if the sid passed as
// the argument is equal to the sid of the user associated with
// the filesystem request.
func (fi *FileInfo) IsRequestorUserSidEqualTo(sid *SID) bool {
	return fi.isRequestorUserSidEqualTo(sid)
}

// CurrentProcessUserSid is a utility to get the
// SID of the current user running the process.
func CurrentProcessUserSid() (*SID, error) {
	return currentProcessUserSid()
}
