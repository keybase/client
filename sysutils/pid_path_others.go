// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !darwin,!linux

package sysutils

// GetExecPathFromPID returns the process's executable path for given PID.
func GetExecPathFromPID(pid uint32) (string, error) {
	return "", NotImplementedError{}
}
