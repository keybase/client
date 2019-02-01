package main

import (
	"errors"
	"os"
	"os/exec"
	"path"
	"path/filepath"

	"github.com/keybase/client/go/utils"
)

var errKeybaseNotFound = errors.New("failed to find the keybase binary")

// findKeybaseBinary returns the path to a Keybase binary, if it finds it.
func findKeybaseBinary(name string) (string, error) {
	// Is it near the kbnm binary?
	binPath, err := utils.BinPath()
	if err == nil {
		binPath := filepath.Join(path.Dir(binPath), name)
		if _, err := os.Stat(binPath); !os.IsNotExist(err) {
			return binPath, nil
		}
	}

	// Is it in our PATH?
	binPath, err = exec.LookPath(name)
	if err == nil {
		return binPath, nil
	}

	// Last ditch effort!
	binPath = guessKeybasePath(name)
	if _, err := os.Stat(binPath); !os.IsNotExist(err) {
		return binPath, nil
	}

	return "", errKeybaseNotFound
}
