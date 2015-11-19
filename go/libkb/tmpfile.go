// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"os"
)

// TempFile creates a termporary file. Use mode=0 for default permissions.
func TempFile(prefix string, mode os.FileMode) (string, *os.File, error) {
	if prefix == "" {
		return "", nil, fmt.Errorf("Prefix was an empty string")
	}
	filename, err := RandString(fmt.Sprintf("%s.", prefix), 20)
	if err != nil {
		return "", nil, err
	}
	flags := os.O_WRONLY | os.O_CREATE | os.O_EXCL
	if mode == 0 {
		mode = PermFile
	}
	file, err := os.OpenFile(filename, flags, mode)
	return filename, file, err
}
