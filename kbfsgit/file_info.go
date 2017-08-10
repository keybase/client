// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"os"
	"time"
)

// FileInfo is a wrapper around libkbfs.EntryInfo that implements the
// os.FileInfo interface.
type FileInfo struct {
}

var _ os.FileInfo = (*FileInfo)(nil)

// Name implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Name() string {
	return ""
}

// Size implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Size() int64 {
	return 0
}

// Mode implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Mode() os.FileMode {
	return 0
}

// ModTime implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) ModTime() time.Time {
	return time.Time{}
}

// IsDir implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) IsDir() bool {
	return false
}

// Sys implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Sys() interface{} {
	return nil
}
