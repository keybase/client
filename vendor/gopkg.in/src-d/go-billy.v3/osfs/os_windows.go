// +build windows

package osfs

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Stat returns the FileInfo structure describing file.
func (fs *OS) Stat(filename string) (os.FileInfo, error) {
	// TODO: remove this in Go 1.9
	target, err := fs.Readlink(filename)
	if err != nil {
		return os.Stat(filename)
	}

	if !filepath.IsAbs(target) && !strings.HasPrefix(target, string(filepath.Separator)) {
		target = fs.Join(filepath.Dir(filename), target)
	}

	fi, err := fs.Stat(target)
	if err != nil {
		return nil, err
	}

	return &fileInfo{
		FileInfo: fi,
		name:     filepath.Base(filename),
	}, nil
}

type fileInfo struct {
	os.FileInfo
	name string
}

func (fi *fileInfo) Name() string {
	return fi.name
}

var (
	kernel32DLL    = windows.NewLazySystemDLL("kernel32.dll")
	lockFileExProc = kernel32DLL.NewProc("LockFileEx")
	unlockFileProc = kernel32DLL.NewProc("UnlockFile")
)

const (
	lockfileExclusiveLock = 0x2
)

// Lock protects file from access from other processes.
func (f file) Lock() error {
	var overlapped windows.Overlapped
	// err is always non-nil as per sys/windows semantics.
	ret, _, err := lockFileExProc.Call(f.File.Fd(), lockfileExclusiveLock, 0, 0xFFFFFFFF, 0,
		uintptr(unsafe.Pointer(&overlapped)))
	runtime.KeepAlive(&overlapped)
	if ret == 0 {
		return err
	}
	return nil
}
func (f file) Unlock() error {
	// err is always non-nil as per sys/windows semantics.
	ret, _, err := unlockFileProc.Call(f.File.Fd(), 0, 0, 0xFFFFFFFF, 0)
	if ret == 0 {
		return err
	}
	return nil
}
