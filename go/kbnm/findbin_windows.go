package main

// +build windows

import (
	"os"
	"path/filepath"
)

const keybaseBinary = "keybase.exe"

// guessKeybasePath makes a platform-specific guess to where the binary might be.
func guessKeybasePath() string {
	return filepath.Join(os.Getenv("LOCALAPPDATA"), "Keybase", keybaseBinary)
}
