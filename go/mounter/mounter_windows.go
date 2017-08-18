// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package mounter

import "fmt"

// Unmount tries to unmount normally and then if force if unsuccessful.
func Unmount(dir string, force bool, log Log) error {
	return fmt.Errorf("Unmount unsupported on this platform")
}

// ForceUnmount tries to forceably unmount a directory
func ForceUnmount(dir string, log Log) (err error) {
	return fmt.Errorf("ForceUnmount unsupported on this platform")
}
