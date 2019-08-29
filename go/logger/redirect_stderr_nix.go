// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin freebsd netbsd openbsd

package logger

import (
	"os"
	"syscall"
)

func tryRedirectStderrTo(f *os.File) error {
	// Calling dup2 first closes the current stderr and then dups the new handle there.
	return syscall.Dup2(int(f.Fd()), 2)
}
