// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"math"
	"unsafe"

	"github.com/pkg/errors"
	"golang.org/x/sys/windows"
)

// getDiskLimits gets the disk limits for the logical disk containing
// the given path.
func getDiskLimits(path string) (
	availableBytes, totalBytes, availableFiles, totalFiles uint64, err error) {
	pathPtr, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return 0, 0, 0, 0, errors.WithStack(err)
	}

	dll := windows.NewLazySystemDLL("kernel32.dll")
	proc := dll.NewProc("GetDiskFreeSpaceExW")
	r1, _, err := proc.Call(uintptr(unsafe.Pointer(pathPtr)),
		uintptr(unsafe.Pointer(&availableBytes)),
		uintptr(unsafe.Pointer(&totalBytes)), 0)
	// err is always non-nil, but meaningful only when r1 == 0
	// (which signifies function failure).
	if r1 == 0 {
		return 0, 0, 0, 0, errors.WithStack(err)
	}

	// TODO: According to http://superuser.com/a/104224 , on
	// Windows, the available file limit is determined just from
	// the filesystem type. Detect the filesystem type and use
	// that to determine and return availableFiles.

	// For now, assume all FSs on Windows are NTFS, or have
	// similarly large file limits.
	return availableBytes, totalBytes, math.MaxInt64, math.MaxInt64, nil
}
