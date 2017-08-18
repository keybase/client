// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package libkb

import (
	"fmt"
	"os"
	"syscall"
)

// Lock writes the pid to filename after acquiring a lock on the file.
// When the process exits, the lock will be released.
func (f *LockPIDFile) Lock() (err error) {

	if f.file, err = os.OpenFile(f.name, os.O_CREATE|os.O_RDWR, 0600); err != nil {
		return PIDFileLockError{f.name}
	}

	// LOCK_EX = exclusive
	// LOCK_NB = nonblocking
	if err = syscall.Flock(int(f.file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		f.file.Close()
		f.file = nil
		return PIDFileLockError{f.name}
	}

	pid := os.Getpid()
	fmt.Fprintf(f.file, "%d", pid)
	f.file.Sync()

	G.Log.Debug("Locked pidfile %s for pid=%d", f.name, pid)

	return nil
}
