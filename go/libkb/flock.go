package libkb

import (
	"fmt"
	"os"
	"syscall"
)

type LockPIDFile struct {
	name string
	file *os.File
}

func NewLockPIDFile(s string) *LockPIDFile {
	return &LockPIDFile{name: s}
}

// Lock writes the pid to filename after acquiring a lock on the file.
// When the process exits, the lock will be released.
func (f *LockPIDFile) Lock() (err error) {
	// os.OpenFile adds syscall.O_CLOEXEC automatically
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
	f.file.Sync()

	G.Log.Debug("Locked pidfile %s for pid=%d", f.name, pid)

	return nil
}

func (f *LockPIDFile) Close() (err error) {
	if f.file != nil {
		if e1 := f.file.Close(); e1 != nil {
			G.Log.Warning("Error closing pid file: %s\n", e1)
		}
		G.Log.Debug("Cleaning up pidfile %s", f.name)
		if err = os.Remove(f.name); err != nil {
			G.Log.Warning("Error removing pidfile: %s\n", err)
		}
	}
	return
}
