// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build dragonfly || freebsd || linux || nacl || netbsd || openbsd || solaris
// +build dragonfly freebsd linux nacl netbsd openbsd solaris

package pinentry

import "os"

func HasWindows() bool {
	//If there is a DISPLAY then we can spawn a window to it.
	return len(os.Getenv("DISPLAY")) > 0
}
