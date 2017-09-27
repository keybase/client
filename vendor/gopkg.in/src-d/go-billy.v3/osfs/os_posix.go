// +build !windows

package osfs

import (
	"os"
	"syscall"
)

// Stat returns the FileInfo structure describing file.
func (fs *OS) Stat(filename string) (os.FileInfo, error) {
	return os.Stat(filename)
}

// Lock protects file from access from other processes.
func (f file) Lock() error {
	return syscall.Flock(int(f.File.Fd()), syscall.LOCK_EX)
}
func (f file) Unlock() error {
	return syscall.Flock(int(f.File.Fd()), syscall.LOCK_UN)
}
