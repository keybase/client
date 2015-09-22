package libkb

import (
	"fmt"
)

// Version as MAJOR.MINOR.PATCH
const Version = "1.0.0"

// Build number
const Build = "23"

// VersionString returns semantic version string.
// If short is true, don't include build in version string, e.g. "1.2.3".
// Otherwise include build, e.g. "1.2.3-400".
func VersionString(short bool) string {
	if short || Build == "" {
		return Version
	}
	return fmt.Sprintf("%s-%s", Version, Build)

}
