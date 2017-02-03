// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"unsafe"

	"github.com/pkg/errors"
	"golang.org/x/sys/windows"
)

// getDiskLimits gets a diskLimits object for the logical disk
// containing the given path.
//
// TODO: Also return available files.
func getDiskLimits(path string) (availableBytes uint64, err error) {
	pathPtr, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return 0, errors.WithStack(err)
	}

	dll := windows.NewLazySystemDLL("kernel32.dll")
	proc := dll.NewProc("GetDiskFreeSpaceExW")
	r1, _, err := proc.Call(uintptr(unsafe.Pointer(pathPtr)),
		uintptr(unsafe.Pointer(&availableBytes)), 0, 0)
	// err is always non-nil, but meaningful only when r1 == 0
	// (which signifies function failure).
	if r1 == 0 {
		return 0, errors.WithStack(err)
	} else {
		err = nil
	}

	// TODO: According to http://superuser.com/a/104224 , on
	// Windows, the available file limit is determined just from
	// the filesystem type. Detect the filesystem type and use
	// that to determine and return availableFiles.

	return availableBytes, nil
}
