// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package client

func GetInstallLogPath() (string, error) {
	return "", nil
}
