// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package service

import (
	"errors"
)

func getMountDirs() ([]string, error) {
	return []string{}, errors.New("getMountDirs is Windows only")
}
