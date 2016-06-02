// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// AutoInstall is not supported on Windows
func AutoInstall(g *libkb.GlobalContext, binPath string, force bool) (newProc bool, err error) {
	return false, fmt.Errorf("Auto install not supported for this build or platform")
}

// CheckIfValidLocation is not supported on Windows
func CheckIfValidLocation() *keybase1.Error {
	return nil
}

// KBFSBinPath returns the path to the KBFS executable
func KBFSBinPath(runMode libkb.RunMode, binPath string) (string, error) {
	return kbfsBinPathDefault(runMode, binPath)
}

func kbfsBinName(runMode libkb.RunMode) (string, error) {
	if runMode != libkb.ProductionRunMode {
		return "", fmt.Errorf("KBFS is currently only supported in production on Windows")
	}
	return "kbfsdokan.exe", nil
}

// RunAfterStartup is not supported on Windows
func RunAfterStartup(g *libkb.GlobalContext, isService bool) error {
	return nil
}
