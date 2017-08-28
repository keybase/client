// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build android

package main

import (
	"errors"
	"os"
)

func dupStderr() (*os.File, error) {
	return nil, errors.New("Duplicating stderr is not supported on this operating system")
}
