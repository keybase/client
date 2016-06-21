// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package mounter

import "fmt"

// IsMounted returns true if directory is mounted (by kbfuse)
func IsMounted(dir string, log Log) (bool, error) {
	return false, fmt.Errorf("IsMounted unsupported on this platform")
}
