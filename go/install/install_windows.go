// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// AutoInstall is not supported on Windows
func AutoInstall(context Context, binPath string, force bool, log Log) (newProc bool, err error) {
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

func kbfsBinName() string {
	return "kbfsdokan.exe"
}

func updaterBinName() (string, error) {
	// Can't name it updater.exe because of Windows "Install Detection Heuristic",
	// which is complete and total BULLSHIT LOL:
	// https://technet.microsoft.com/en-us/library/cc709628%28v=ws.10%29.aspx?f=255&MSPPError=-2147217396
	return "upd.exe", nil
}

// RunAfterStartup is not supported on Windows
func RunAfterStartup(context Context, isService bool, log Log) error {
	return nil
}

// RunApp starts the app
func RunApp(context Context, log Log) error {
	// TODO: Start the app
	return nil
}
