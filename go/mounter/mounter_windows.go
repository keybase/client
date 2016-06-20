// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package mounter

import (
	"fmt"

	"github.com/keybase/client/go/logger"
)

// Unmount tries to unmount normally and then if force if unsuccessful.
func Unmount(dir string, force bool, log logger.Logger) error {
	return fmt.Errorf("Unmount unsupported on this platform")
}

// ForceUnmount tries to forceably unmount a directory
func ForceUnmount(dir string, log logger.Logger) (err error) {
	return fmt.Errorf("ForceUnmount unsupported on this platform")
}
