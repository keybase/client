// +build windows

package main

import (
	"os"
	"path/filepath"
)

const kbnmBinary = "kbnm.exe"
const keybaseBinary = "keybase.exe"

// guessKeybasePath makes a platform-specific guess to where the binary might
// be. This is only checked as a last-ditch effort when we can't find the
// binary in other places.
func guessKeybasePath(name string) string {
	return filepath.Join(os.Getenv("LOCALAPPDATA"), "Keybase", name)
}
