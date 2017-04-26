// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build linux,!android darwin freebsd openbsd

package logger

import (
	"os"
	"golang.org/x/sys/unix"
)

func tryRedirectStderrTo(f *os.File) error {
	// Calling dup2 first closes the current stderr and then dups the new handle there.
	return unix.Dup2(int(f.Fd()), 2)
}
