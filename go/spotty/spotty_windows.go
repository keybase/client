// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build windows
// +build windows

package spotty

// Discover does nothing on Windows
func Discover() (string, error) {
	return "", nil
}
