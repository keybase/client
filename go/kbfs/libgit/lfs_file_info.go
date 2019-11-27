// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"os"
	"time"
)

type lfsFileInfo struct {
	name  string
	oid   string
	size  int64
	mtime time.Time
}

var _ os.FileInfo = (*lfsFileInfo)(nil)

func (lfi *lfsFileInfo) Name() string {
	return lfi.name
}

func (lfi *lfsFileInfo) Size() int64 {
	return lfi.size
}

func (lfi *lfsFileInfo) Mode() os.FileMode {
	return 0600
}

func (lfi *lfsFileInfo) ModTime() time.Time {
	return lfi.mtime
}

func (lfi *lfsFileInfo) IsDir() bool {
	return false
}

func (lfi *lfsFileInfo) Sys() interface{} {
	return nil
}
