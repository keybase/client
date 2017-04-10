// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package mounter

import "fmt"

// IsMounted returns true if directory is mounted (by kbfuse)
func IsMounted(dir string, log Log) (bool, error) {
	return false, fmt.Errorf("IsMounted unsupported on this platform")
}

// Unmount tries to unmount normally and then if force if unsuccessful.
func Unmount(dir string, force bool, log Log) error {
	return fmt.Errorf("Unmount unsupported on this platform")
}

// ForceUnmount tries to forceably unmount a directory
func ForceUnmount(dir string, log Log) (err error) {
	return fmt.Errorf("ForceUnmount unsupported on this platform")
}
