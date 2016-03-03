// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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
