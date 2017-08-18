// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package spotty

// Discover does nothing on Windows
func Discover() (string, error) {
	return "", nil
}
