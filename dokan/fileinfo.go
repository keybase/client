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

// File replacement flags for CreateFile
const (
	FileSupersede   = C.FILE_SUPERSEDE
	FileCreate      = C.FILE_CREATE
	FileOpen        = C.FILE_OPEN
	FileOpenIf      = C.FILE_OPEN_IF
	FileOverwrite   = C.FILE_OVERWRITE
	FileOverwriteIf = C.FILE_OVERWRITE_IF
)

// CreateOptions stuff
const (
	FileDirectoryFile    = C.FILE_DIRECTORY_FILE
	FileNonDirectoryFile = C.FILE_NON_DIRECTORY_FILE
)
