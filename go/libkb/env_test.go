// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"path/filepath"
	"testing"
)

func TestEnvDarwin(t *testing.T) {
	env := newEnv(nil, nil, "darwin")

	sockFile, err := env.GetSocketBindFile()
	if err != nil {
		t.Fatal(err)
	}

	// Switch to env.GetSandboxCacheDir() when we change locations
	cacheDir := env.GetCacheDir()
	expectedSockFile := filepath.Join(cacheDir, "keybased.sock")
	if sockFile != expectedSockFile {
		t.Fatalf("Clients expect sock file to be %s", expectedSockFile)
	}
}
