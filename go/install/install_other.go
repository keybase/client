// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin,!linux

package install

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func AutoInstall(g *libkb.GlobalContext, binPath string, force bool) (newProc bool, err error) {
	return false, fmt.Errorf("Auto install not supported for this build or platform")
}

func CheckIfValidLocation() *keybase1.Error {
	return nil
}

// KBFSBinPath returns the path to the KBFS executable
func KBFSBinPath(runMode libkb.RunMode, binPath string) (string, error) {
	return "", fmt.Errorf("Unsupported for this build or platform")
}

func RunAfterStartup(g *libkb.GlobalContext, isService bool) error {
	return nil
}
