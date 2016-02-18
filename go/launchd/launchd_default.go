// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package launchd

import (
	"fmt"

	"github.com/keybase/client/go/logger"
)

func Restart(label string, log logger.Logger) error {
	return fmt.Errorf("Unsupported on this platform")
}

func Start(label string, log logger.Logger) error {
	return fmt.Errorf("Unsupported on this platform")
}

func Stop(label string, wait bool, log logger.Logger) error {
	return fmt.Errorf("Unsupported on this platform")
}
