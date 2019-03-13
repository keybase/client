// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"os"
	"time"
)

type diffFileInfo struct {
	name  string
	size  int64
	mtime time.Time
}

var _ os.FileInfo = (*diffFileInfo)(nil)

func (cfi *diffFileInfo) Name() string {
	return cfi.name
}

func (cfi *diffFileInfo) Size() int64 {
	return cfi.size
}

func (cfi *diffFileInfo) Mode() os.FileMode {
	// Make it read-only.
	return 0600
}

func (cfi *diffFileInfo) ModTime() time.Time {
	return cfi.mtime
}

func (cfi *diffFileInfo) IsDir() bool {
	return false
}

func (cfi *diffFileInfo) Sys() interface{} {
	return nil
}
