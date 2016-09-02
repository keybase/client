// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"path/filepath"
	"testing"
)

func TestEnvDarwin(t *testing.T) {
	env := newEnv(nil, nil, "darwin")

	runtimeDir := env.GetRuntimeDir()
	sockFile, err := env.GetSocketFile()
	if err != nil {
		t.Fatal(err)
	}

	expectedSockFile := filepath.Join(runtimeDir, "keybased.sock")
	if sockFile != expectedSockFile {
		t.Fatalf("Clients expect sock file to be %s", expectedSockFile)
	}
}
