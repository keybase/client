// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"os"
	"strings"
	"testing"
)

func TestTempFile(t *testing.T) {
	name, file, err := OpenTempFile("test", "", 0700)
	if err != nil {
		t.Errorf("%s", err)
	}
	defer file.Close()
	if file == nil {
		t.Fatalf("No file")
	}
	defer os.Remove(name)
	if !strings.HasPrefix(name, "test.") {
		t.Errorf("Bad temp file name: %s", name)
	}
	if len(name) < 37 {
		t.Errorf("Bad temp file name length: %s", name)
	}
}
