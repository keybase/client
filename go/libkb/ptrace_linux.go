// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build linux,!android

package libkb

import (
	"syscall"
)

// Disallow ptrace attachment on linux system by setting
// PR_SET_DUMPABLE. This makes it impossible to e.g. attach gdb or use
// gcore on keybase process. Modern linux system are already ptrace-
// hardened by setting "restricted ptrace" using Yama
// (https://www.kernel.org/doc/Documentation/security/Yama.txt).

// Note that one can still attach ptrace as root, unless ptrace_scope
// is set to 3, which locks ptrace completely.

func prctl(option int, arg uint64) error {
	_, _, errno := syscall.Syscall6(syscall.SYS_PRCTL, uintptr(option), uintptr(arg), 0, 0, 0, 0)
	if errno != 0 {
		return errno
	}
	return nil
}

func DisableProcessTracing() error {
	return prctl(syscall.PR_SET_DUMPABLE, 0)
}
