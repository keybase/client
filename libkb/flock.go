package libkb

import (
	"fmt"
	"os"
	"syscall"
)

// LockPIDFile writes the pid to filename after acquiring a lock on the file.
// When the process exits, the lock will be released.
func LockPIDFile(filename string) error {
	// os.OpenFile adds syscall.O_CLOEXEC automatically
	f, err := os.OpenFile(filename, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return err
	}

	// LOCK_EX = exclusive
	// LOCK_NB = nonblocking
	if err = syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		return err
	}

	fmt.Fprintf(f, "%d", os.Getpid())
	f.Sync()

	return nil
}
