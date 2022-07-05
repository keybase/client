// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package dokan

import "C"

import (
	"errors"

	"github.com/keybase/client/go/kbfs/dokan/winacl"
)

var errNotWindows = errors.New("dokan not supported outside Windows")

func loadDokanDLL(*Config) error { return errNotWindows }

// FileInfo contains information about files, this is a dummy definition.
type FileInfo struct {
	ptr *struct {
		DeleteOnClose int
		DokanOptions  struct {
			GlobalContext uint64
		}
	}
	rawPath struct{}
}

func (*FileInfo) isRequestorUserSidEqualTo(sid *winacl.SID) bool { return false }

type dokanCtx struct{}

func allocCtx(slot uint32) *dokanCtx                     { return nil }
func (*dokanCtx) Run(path string, flags MountFlag) error { return errNotWindows }
func (*dokanCtx) Free()                                  {}

func lpcwstrToString(struct{}) string { return "" }

func unmount(path string) error {
	return errNotWindows
}

const (
	kbfsLibdokanDebug = MountFlag(0)
	kbfsLibdokanStderr
	kbfsLibdokanRemovable
	kbfsLibdokanMountManager
	kbfsLibdokanCurrentSession
	kbfsLibdokanUseFindFilesWithPattern
)

func currentProcessUserSid() (*winacl.SID, error) { // nolint
	return nil, errNotWindows
}
