// +build linux darwin

package main

import (
	"unsafe"

	"golang.org/x/sys/unix"
)

func touch(path string) error {
	// Go does not currently have a clean way of doing what touch
	// does. Recreate the very low level syscall explicitly.
	//
	// https://github.com/golang/go/issues/11830
	_p0, err := unix.BytePtrFromString(path)
	if err != nil {
		return err
	}
	_, _, e1 := unix.Syscall(unix.SYS_UTIMES, uintptr(unsafe.Pointer(_p0)), uintptr(0), 0)
	if e1 != 0 {
		return e1
	}
	return nil
}
