// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package version

import (
	"testing"
	"time"
)

func TestParse(t *testing.T) {
	input := "Keybase-1.0.14-20160312013917+cd6f696.zip"
	version, versionShort, versionTime, commit, err := Parse(input)
	if err != nil {
		t.Fatal(err)
	}
	if version != "1.0.14-20160312013917+cd6f696" {
		t.Errorf("Failed to parse version properly: %s", version)
	}
	if versionShort != "1.0.14" {
		t.Errorf("Failed to parse version properly: %s", versionShort)
	}
	timeCheck, _ := time.Parse("20060102150405", "20160312013917")
	if versionTime != timeCheck {
		t.Errorf("Failed to parse time properly: %s", timeCheck)
	}
	if commit != "cd6f696" {
		t.Errorf("Failed to parse commit properly: %s", commit)
	}
}
