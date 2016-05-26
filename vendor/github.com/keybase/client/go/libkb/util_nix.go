// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin dragonfly freebsd linux nacl netbsd openbsd solaris

package libkb

import (
	"errors"
	"os"
)

func canExec(s string) error {
	fi, err := os.Stat(s)
	if err != nil {
		return err
	}
	mode := fi.Mode()

	//
	// Only consider non-directories that have at least one +x
	//  bit set.
	//
	// TODO: Recheck this on windows!
	//   See here for lookpath: http://golang.org/src/pkg/os/exec/lp_windows.go
	//
	// Similar to check from exec.LookPath below
	//   See here: http://golang.org/src/pkg/os/exec/lp_unix.go
	//

	if mode.IsDir() {
		return DirExecError{Path: s}
	}

	if mode&0111 == 0 {
		return FileExecError{Path: s}
	}

	return nil
}

func PosixLineEndings(arg string) string {
	return arg
}

func AppDataDir() (string, error) {
	return "", errors.New("unsupported: AppDataDir")
}
