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
	switch runMode {
	case libkb.DevelRunMode:
		return "kbfsdev", nil

	case libkb.StagingRunMode:
		return "kbfsstage", nil

	case libkb.ProductionRunMode:
		return "kbfs", nil

	default:
		return "", fmt.Errorf("Invalid run mode: %s", runMode)
	}
}

func updaterBinName() (string, error) {
	return "updater", nil
}
