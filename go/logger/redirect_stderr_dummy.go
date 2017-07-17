// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build android

package logger

import (
	"errors"
	"os"
)

func tryRedirectStderrTo(f *os.File) (err error) {
	return errors.New("Redirecting stderr is not supported on this operating system")
}
