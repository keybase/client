// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build linux android darwin freebsd openbsd

package stderrutils

import (
	"os"
	"syscall"
)

// DupStderr duplicates stderr and return it as an *os.File. Use this to
// preserve stderr before any redirection (e.g. from keybase/client/go/logger)
// if needed.
func DupStderr() (*os.File, error) {
	dupStderrFd, err := syscall.Dup(2)
	if err != nil {
		return nil, err
	}
	stderrFile := os.NewFile(uintptr(dupStderrFd), "stderr")
	return stderrFile, nil
}
