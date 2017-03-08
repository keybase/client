// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package sysutils

import (
	"bytes"
	"syscall"
	"unsafe"
)

const (
	procpidpathinfo     = 11
	procpidpathinfosize = 1024
	proccallnumpidinfo  = 2
)

// GetExecPathFromPID returns the process's executable path for given PID.
func GetExecPathFromPID(pid uint32) (string, error) {
	buf := make([]byte, procpidpathinfosize)
	_, _, errno := syscall.Syscall6(
		syscall.SYS_PROC_INFO,
		proccallnumpidinfo,
		uintptr(pid),
		procpidpathinfo,
		0,
		uintptr(unsafe.Pointer(&buf[0])),
		procpidpathinfosize)
	if errno != 0 {
		return "", errno
	}
	firstZero := bytes.IndexByte(buf, 0)
	if firstZero <= 0 {
		return "", nil
	}
	return string(buf[:firstZero]), nil
}
