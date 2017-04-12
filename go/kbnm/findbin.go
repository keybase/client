package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/kardianos/osext"
)

var errKeybaseNotFound = errors.New("failed to find the keybase binary")

// findKeybaseBinary returns the path to the Keybase binary, if it finds it.
func findKeybaseBinary() (string, error) {
	// Is it near the kbnm binary?
	dir, err := osext.ExecutableFolder()
	if err == nil {
		path := filepath.Join(dir, keybaseBinary)
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			return path, nil
		}
	}

	// Is it in our PATH?
	path, err := exec.LookPath(keybaseBinary)
	if err == nil {
		return path, nil
	}

	// Last ditch effort!
	path = guessKeybasePath()
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		return path, nil
	}

	return "", errKeybaseNotFound
}
