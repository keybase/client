// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"os"
	"path/filepath"
)

// OpenTempFile creates an opened termporary file. Use mode=0 for default
// permissions.
//
// OpenTempFile("foo", ".zip", 0755) => "foo.RCG2KUSCGYOO3PCKNWQHBOXBKACOPIKL.zip"
// OpenTempFile(path.Join(os.TempDir(), "foo"), "", 0) => "/tmp/foo.RCG2KUSCGYOO3PCKNWQHBOXBKACOPIKL"
//
func OpenTempFile(prefix string, suffix string, mode os.FileMode) (string, *os.File, error) {
	if prefix == "" {
		return "", nil, fmt.Errorf("Prefix was an empty string")
	}
	filename, err := RandString(fmt.Sprintf("%s.", prefix), 20)
	if err != nil {
		return "", nil, err
	}
	if suffix != "" {
		filename = filename + suffix
	}
	flags := os.O_WRONLY | os.O_CREATE | os.O_EXCL
	if mode == 0 {
		mode = PermFile
	}
	file, err := os.OpenFile(filename, flags, mode)
	return filename, file, err
}

// TempFileName returns a temporary random filename
func TempFileName(prefix string) (tmp string, err error) {
	tmp, err = RandString(prefix, 20)
	return
}

// TempFile returns a random path name in os.TempDir()
func TempFile(prefix string) (string, error) {
	tmp, err := TempFileName(prefix)
	if err != nil {
		return "", err
	}
	return filepath.Join(os.TempDir(), tmp), nil
}
