package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/kardianos/osext"
)

var errKeybaseNotFound = errors.New("failed to find the keybase binary")

// findKeybaseBinary returns the path to a Keybase binary, if it finds it.
func findKeybaseBinary(name string) (string, error) {
	// Is it near the kbnm binary?
	dir, err := osext.ExecutableFolder()
	if err == nil {
		path := filepath.Join(dir, name)
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
