// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package install

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

func kbfsBinName(runMode libkb.RunMode) (string, error) {
	if runMode != libkb.ProductionRunMode {
		return "", fmt.Errorf("KBFS is currently only supported in production")
	}
	return "kbfsdokan", nil
}
