// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build android

package stderrutils

import (
	"errors"
	"os"
)

// DupStderr makes compiler happy on unsupported platforms.
func DupStderr() (*os.File, error) {
	return nil, errors.New("Duplicating stderr is not supported on this operating system")
}
