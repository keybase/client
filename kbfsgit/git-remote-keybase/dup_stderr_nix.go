// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build linux,!android darwin freebsd openbsd

package main

import (
	"os"
	"syscall"
)

func dupStderr() (*os.File, error) {
	dupStderrFd, err := syscall.Dup(2)
	if err != nil {
		return nil, err
	}
	stderrFile := os.NewFile(uintptr(dupStderrFd), "stderr")
	return stderrFile, nil
}
