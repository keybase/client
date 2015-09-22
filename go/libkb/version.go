package libkb

import (
	"fmt"
)

// Version as MAJOR.MINOR.PATCH
const Version = "1.0.0"

// Build number
const Build = "23"

// VersionString returns semantic version string.
func VersionString() string {
	return fmt.Sprintf("%s-%s", Version, Build)
}
