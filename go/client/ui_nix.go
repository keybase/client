// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package client

import (
	"io"
	"os"
)

func (ui *UI) OutputWriter() io.Writer {
	return os.Stdout
}
