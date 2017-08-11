// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"os"
	"time"

	"github.com/keybase/kbfs/libkbfs"
)

// FileInfo is a wrapper around libkbfs.EntryInfo that implements the
// os.FileInfo interface.
type FileInfo struct {
	fs   *FS
	ei   libkbfs.EntryInfo
	name string
}

var _ os.FileInfo = (*FileInfo)(nil)

// Name implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Name() string {
	return fi.name
}

// Size implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Size() int64 {
	// TODO: deal with overflow?
	return int64(fi.ei.Size)
}

// Mode implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Mode() os.FileMode {
	mode, err := WritePermMode(
		fi.fs.ctx, os.FileMode(0), fi.fs.config.KBPKI(), fi.fs.h)
	if err != nil {
		fi.fs.log.CWarningf(
			fi.fs.ctx, "Couldn't get mode for file %s: %+v", fi.name, err)
		mode = os.FileMode(0)
	}

	mode |= 0400
	switch fi.ei.Type {
	case libkbfs.Dir:
		mode |= os.ModeDir | 0100
	case libkbfs.Sym:
		mode |= os.ModeSymlink
	case libkbfs.Exec:
		mode |= 0100
	}
	return mode
}

// ModTime implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) ModTime() time.Time {
	return time.Unix(0, fi.ei.Mtime)
}

// IsDir implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) IsDir() bool {
	return fi.ei.Type == libkbfs.Dir
}

// Sys implements the os.FileInfo interface for FileInfo.
func (fi *FileInfo) Sys() interface{} {
	return fi.ei
}
