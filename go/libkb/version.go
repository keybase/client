package libkb

import (
	"fmt"
)

// Version as MAJOR.MINOR.PATCH
const Version = "1.0.0"

// Build number
const Build = "22"

// VersionString returns semantic version string.
// If devel, include build in version string (for development releases), for
// example, "1.2.3-400". Otherwise only return version string as
// MAJOR.MINOR.PATCH. For example, "1.2.3".
func VersionString(devel bool) string {
	if devel && Build != "" {
		return fmt.Sprintf("%s-%s", Version, Build)
	}
	return Version
}
