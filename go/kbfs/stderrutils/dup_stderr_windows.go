// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package stderrutils

import (
	"os"

	"golang.org/x/sys/windows"
)

// DupStderr duplicates stderr and return it as an *os.File. Use this to
// preserve stderr before any redirection (e.g. from keybase/client/go/logger)
// if needed.
func DupStderr() (*os.File, error) {
	proc, err := windows.GetCurrentProcess()
	if err != nil {
		return nil, err
	}

	var dupStderrFd windows.Handle
	err = windows.DuplicateHandle(
		proc, windows.Handle(os.Stderr.Fd()), proc, &dupStderrFd, 0,
		true, windows.DUPLICATE_SAME_ACCESS)
	if err != nil {
		return nil, err
	}

	stderrFile := os.NewFile(uintptr(dupStderrFd), "stderr")
	return stderrFile, nil
}
