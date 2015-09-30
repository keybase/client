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
	t.Logf("%s\n", sockFile)

	expectedSockFile := filepath.Join(runtimeDir, "keybased.sock")
	if sockFile != expectedSockFile {
		t.Fatal("Clients expect sock file to be %s", expectedSockFile)
	}
}
