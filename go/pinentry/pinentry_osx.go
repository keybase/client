// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin
// +build darwin

package pinentry

import (
	"os"
)

func HasWindows() bool {
	// We aren't in an ssh connection, so we can probably spawn a window.
	return len(os.Getenv("SSH_CONNECTION")) == 0
}
