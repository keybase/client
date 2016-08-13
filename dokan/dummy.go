// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package dokan

import "C"

import (
	"errors"
)

var errNotWindows = errors.New("Dokan not supported outside Windows.")

func loadDokanDLL(fullpath string) error { return errNotWindows }

// FileInfo contains information about files, this is a dummy definition.
type FileInfo struct {
	ptr *struct {
		DeleteOnClose int
	}
	rawPath struct{}
}

func (*FileInfo) isRequestorUserSidEqualTo(sid *SID) bool { return false }

type dokanCtx struct{}

func allocCtx(slot uint32) *dokanCtx                     { return nil }
func (*dokanCtx) Run(path string, flags MountFlag) error { return errNotWindows }
func (*dokanCtx) Free()                                  {}

func lpcwstrToString(struct{}) string { return "" }

func unmount(path string) error {
	return errNotWindows
}

// SID is on Windows type SID = syscall.SID. This is a dummy definition.
type SID struct{}

const (
	kbfsLibdokanDebug = MountFlag(0)
	kbfsLibdokanStderr
	kbfsLibdokanRemovable
	kbfsLibdokanMountManager
	kbfsLibdokanCurrentSession
	kbfsLibdokanUseFindFilesWithPattern
)

func currentProcessUserSid() (*SID, error) {
	return nil, errNotWindows
}
