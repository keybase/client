// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package libkb

import (
	"fmt"
	"os"
	"syscall"
)

// Open the file with exclusive access (locked to other processes)
// When the process exits, the lock will be released.
func (f *LockPIDFile) Lock() (err error) {
	pathp, err := syscall.UTF16PtrFromString(f.name)
	if err != nil {
		return PIDFileLockError{f.name}
	}
	access := uint32(syscall.GENERIC_READ | syscall.GENERIC_WRITE)
	createmode := uint32(syscall.OPEN_ALWAYS)
	sharemode := uint32(syscall.FILE_SHARE_READ) // os.Open always uses FILE_SHARE_READ | FILE_SHARE_WRITE
	var sa *syscall.SecurityAttributes
	r, err := syscall.CreateFile(pathp, access, sharemode, sa, createmode, syscall.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		return PIDFileLockError{f.name}
	}
	// this is what os.openFile does
	f.file = os.NewFile(uintptr(r), f.name)

	pid := os.Getpid()
	fmt.Fprintf(f.file, "%d", pid)
	f.file.Sync()

	G.Log.Debug("Locked pidfile %s for pid=%d", f.name, pid)

	return nil
}
