// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package libkb

import (
	"testing"
)

func TestEnvWindows(t *testing.T) {
	env := newEnv(nil, nil, "windows", makeLogGetter(t))

	mountDir, err := env.GetMountDir()
	if err != nil {
		t.Fatal(err)
	}

	if mountDir != "" {
		t.Fatalf("Windows needs an empty default mount dir")
	}
}
