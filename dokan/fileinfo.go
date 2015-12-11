// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package dokan

/*
#include "bridge.h"
*/
import "C"

// FileInfo contains information about a file including the path.
type FileInfo struct {
	ptr     C.PDOKAN_FILE_INFO
	rawPath C.LPCWSTR
}

// Path converts the path to UTF-8 running in O(n).
func (fi *FileInfo) Path() string {
	return lpcwstrToString(fi.rawPath)
}

// DeleteOnClose should be checked from Cleanup.
func (fi *FileInfo) DeleteOnClose() bool {
	return fi.ptr.DeleteOnClose != 0
}

func makeFI(fname C.LPCWSTR, pfi C.PDOKAN_FILE_INFO) *FileInfo {
	return &FileInfo{pfi, fname}
}

const (
	FILE_SUPERSEDE    = C.FILE_SUPERSEDE
	FILE_CREATE       = C.FILE_CREATE
	FILE_OPEN         = C.FILE_OPEN
	FILE_OPEN_IF      = C.FILE_OPEN_IF
	FILE_OVERWRITE    = C.FILE_OVERWRITE
	FILE_OVERWRITE_IF = C.FILE_OVERWRITE_IF
)
