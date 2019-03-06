// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package libkb

import (
	"path/filepath"
	"strings"
	"testing"
)

func doDirectoryTest(t *testing.T, d string, description string, suffix string) {

	if len(d) == 0 {
		t.Errorf("Bad %s dir", description)
	}
	parentDir, _ := filepath.Split(d)
	if len(parentDir) == 0 || len(parentDir) == len(d) {
		t.Errorf("Can't get parent of %s", d)
	}

	if !exists(parentDir) {
		t.Errorf("%s does not exist", parentDir)
	}
	if len(suffix)+len(strings.TrimSuffix(d, suffix)) != len(d) {
		t.Errorf("%s does not end with %s", d, suffix)
	}
}

// There isn't much to test; the directory needn't exist yet
func TestWindows(t *testing.T) {
	hf := NewHomeFinder("tester", nil, nil, nil, "windows", func() RunMode { return ProductionRunMode }, makeLogGetter(t), nil)

	doDirectoryTest(t, hf.CacheDir(), "Cache", "")
	doDirectoryTest(t, hf.DataDir(), "Data", "")
	doDirectoryTest(t, hf.ConfigDir(), "Config", "")

	hf = NewHomeFinder("tester", nil, nil, nil, "windows", func() RunMode { return StagingRunMode },
		makeLogGetter(t), nil)

	doDirectoryTest(t, hf.CacheDir(), "Cache", "Staging")
	doDirectoryTest(t, hf.DataDir(), "Data", "Staging")
	doDirectoryTest(t, hf.ConfigDir(), "Config", "Staging")

	hf = NewHomeFinder("tester", nil, nil, nil, "windows", func() RunMode { return DevelRunMode },
		makeLogGetter(t), nil)

	doDirectoryTest(t, hf.CacheDir(), "Cache", "Devel")
	doDirectoryTest(t, hf.DataDir(), "Data", "Devel")
	doDirectoryTest(t, hf.ConfigDir(), "Config", "Devel")

	whf := Win32{Base{"tester", nil, nil, nil, func() RunMode { return DevelRunMode }, makeLogGetter(t), nil}}
	fromTemp := whf.deriveFromTemp()
	if len(fromTemp) == 0 {
		t.Errorf("%s does not exist", fromTemp)
	}

	if !exists(fromTemp) {
		t.Errorf("%s does not exist", fromTemp)
	}

}
