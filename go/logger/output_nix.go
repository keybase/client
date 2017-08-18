// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package logger

import (
	"io"
	"os"
)

func OutputWriter() io.Writer {
	return os.Stdout
}

func ErrorWriter() io.Writer {
	return os.Stderr
}

// SaveConsoleMode records the current text attributes in a global, so
// it can be restored later, in case nonstandard colors are expected.
// (Windows only)
func SaveConsoleMode() error {
	return nil
}

// RestoreConsoleMode restores the current text attributes from a global,
// in case nonstandard colors are expected.
// (Windows only)
func RestoreConsoleMode() {
}
