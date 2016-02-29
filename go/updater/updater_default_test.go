// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package updater

import (
	"io/ioutil"
	"path/filepath"
)

func createTestUpdateFile(path string, version string) (name string, err error) {
	name = filepath.Base(path)
	data := randString(256)
	err = ioutil.WriteFile(path, []byte(data), 0644)
	return
}
