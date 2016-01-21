// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package updater

import (
	"archive/zip"
	"fmt"
	"os"
	"path/filepath"
)

func createTestUpdateFile(version string) (path string, name string, err error) {
	path = filepath.Join(os.TempDir(), "Test.zip")
	// Clear if exists
	if _, ferr := os.Stat(path); ferr == nil {
		err = os.Remove(path)
		if err != nil {
			return
		}
	}
	zipFile, err := os.Create(path)
	if err != nil {
		return
	}
	defer zipFile.Close()

	w := zip.NewWriter(zipFile)
	f, err := w.Create("Test/Test.txt")
	if err != nil {
		return
	}
	_, err = f.Write([]byte("This is a test file for updates"))
	if err != nil {
	}
	err = w.Close()
	if err != nil {
		return
	}
	name = fmt.Sprintf("Test-%s.zip", version)
	return
}
