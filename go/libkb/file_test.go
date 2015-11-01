// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import (
	"os"
	"testing"
)

func TestFileSave(t *testing.T) {
	filename := "file_test.tmp"

	defer os.Remove(filename)

	file := NewFile(filename, []byte("test data"), 0644)
	t.Logf("Saving")
	err := file.Save()
	if err != nil {
		t.Fatal(err)
	}
}
