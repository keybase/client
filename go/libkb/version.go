// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
)

// NOTE: This file is the source of truth for our version number, but we have a
//       script that reads it at packaging/version.sh. If you refactor this
//       file, update that script.

// Version as MAJOR.MINOR.PATCH
const Version = "1.0.4"

// Build number
const Build = "4"

// VersionString returns semantic version string.
func VersionString() string {
	return fmt.Sprintf("%s-%s", Version, Build)
}
