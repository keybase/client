// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build linux darwin

package install

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// kbfsBinName returns the name for the KBFS executable
func kbfsBinName(runMode libkb.RunMode) (string, error) {
	if runMode != libkb.ProductionRunMode {
		return "", fmt.Errorf("KBFS install is currently only supported in production")
	}
	return "kbfs", nil
}

func updaterBinName() (string, error) {
	return "updater", nil
}
