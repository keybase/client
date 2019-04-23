// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"os"
	"time"
)

type wrappedReadFileInfo struct {
	name  string
	size  int64
	mtime time.Time
	dir   bool
}

var _ os.FileInfo = (*wrappedReadFileInfo)(nil)

func (cfi *wrappedReadFileInfo) Name() string {
	return cfi.name
}

func (cfi *wrappedReadFileInfo) Size() int64 {
	return cfi.size
}

func (cfi *wrappedReadFileInfo) Mode() os.FileMode {
	// Make it read-only.
	return 0600
}

func (cfi *wrappedReadFileInfo) ModTime() time.Time {
	return cfi.mtime
}

func (cfi *wrappedReadFileInfo) IsDir() bool {
	return cfi.dir
}

func (cfi *wrappedReadFileInfo) Sys() interface{} {
	return nil
}
