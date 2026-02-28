package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/keybase/client/go/utils"
)

var errKeybaseNotFound = errors.New("failed to find the keybase binary")

// findKeybaseBinary returns the path to a Keybase binary, if it finds it.
func findKeybaseBinary(name string) (string, error) {
	// Is it near the kbnm binary?
	binPath, err := utils.BinPath()
	if err == nil {
		path := filepath.Join(filepath.Dir(binPath), name)
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			return path, nil
		}
	}

	// Is it in our PATH?
	path, err := exec.LookPath(name)
	if err == nil {
		return path, nil
	}

	// Last ditch effort!
	path = guessKeybasePath(name)
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		return path, nil
	}

	return "", errKeybaseNotFound
}
