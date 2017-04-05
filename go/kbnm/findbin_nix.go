package main

// +build !windows

import (
	"path/filepath"
)

const keybaseBinary = "keybase"

// guessKeybasePath makes a platform-specific guess to where the binary might be.
func guessKeybasePath() string {
	return filepath.Join("/usr/local/bin", keybaseBinary)
}
