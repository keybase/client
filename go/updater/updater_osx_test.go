// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package updater

import (
	"archive/zip"
	"fmt"
	"os"
)

func createTestUpdateFile(path string, version string) (name string, err error) {
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
	_, err = f.Write([]byte(randString(256)))
	if err != nil {
	}
	err = w.Close()
	if err != nil {
		return
	}
	name = fmt.Sprintf("Test-%s.zip", version)
	return
}
