package main

// +build !windows

import (
	"path/filepath"
)

const keybaseBinary = "keybase"

// guessKeybasePath makes a platform-specific guess to where the binary might
// be. This is only checked as a last-ditch effort when we can't find the
// binary in other places.
func guessKeybasePath() string {
	return filepath.Join("/usr/local/bin", keybaseBinary)
}
