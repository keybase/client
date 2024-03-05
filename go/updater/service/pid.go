//go:build !windows
// +build !windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
)

// LockPIDFile manages a lock file containing the PID for the current process.
type LockPIDFile struct {
	name string
	file *os.File
	log  Log
}

// NewLockPIDFile creates a LockPIDFile for filename name.
func NewLockPIDFile(name string, log Log) *LockPIDFile {
	return &LockPIDFile{name: name, log: log}
}

// Lock writes the pid to filename after acquiring a lock on the file.
// When the process exits, the lock will be released.
func (f *LockPIDFile) Lock() (err error) {
	// make the parent directory
	_, err = os.Stat(filepath.Dir(f.name))
	if os.IsNotExist(err) {
		err = os.MkdirAll(filepath.Dir(f.name), 0700)
		if err != nil {
			return err
		}
	} else if err != nil {
		return err
	}

	if f.file, err = os.OpenFile(f.name, os.O_CREATE|os.O_RDWR, 0600); err != nil {
		return err
	}

	// LOCK_EX = exclusive
	// LOCK_NB = nonblocking
	if err = syscall.Flock(int(f.file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		f.file.Close()
		f.file = nil
		return err
	}

	pid := os.Getpid()
	fmt.Fprintf(f.file, "%d", pid)
	if err = f.file.Sync(); err != nil {
		return err
	}

	f.log.Debugf("Locked pidfile %s for pid=%d", f.name, pid)

	return nil
}

// Close releases the lock by closing and removing the file.
func (f *LockPIDFile) Close() (err error) {
	if f.file != nil {
		if e1 := f.file.Close(); e1 != nil {
			f.log.Warningf("Error closing pid file: %s\n", e1)
		}
		f.log.Debugf("Cleaning up pidfile %s", f.name)
		if err = os.Remove(f.name); err != nil {
			f.log.Warningf("Error removing pidfile: %s\n", err)
		}
	}
	return
}
