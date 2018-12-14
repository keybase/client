// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package libkb

import (
	"syscall"
)

// Disallow ptrace attachment by using MacOS specific PT_DENY_ATTACH
// ptrace call. This blocks attempts at attaching ptrace to current
// process and drops any other processes that are currently attaching
// to current process.

const PtDenyAttach = 31

func ptrace(request, pid int, addr uintptr, data uintptr) error {
	_, _, errno := syscall.Syscall6(syscall.SYS_PTRACE, uintptr(request), uintptr(pid), uintptr(addr), uintptr(data), 0, 0)
	if errno != 0 {
		return errno
	}
	return nil
}

func DisableProcessTracing() error {
	return ptrace(PtDenyAttach, 0, 0, 0)
}
