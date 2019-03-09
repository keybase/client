// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"os"
	"time"
)

type commitFileInfo struct {
	name  string
	size  int64
	mtime time.Time
}

var _ os.FileInfo = (*commitFileInfo)(nil)

func (cfi *commitFileInfo) Name() string {
	return cfi.name
}

func (cfi *commitFileInfo) Size() int64 {
	return cfi.size
}

func (cfi *commitFileInfo) Mode() os.FileMode {
	// Make it read-only.
	return 0600
}

func (cfi *commitFileInfo) ModTime() time.Time {
	return cfi.mtime
}

func (cfi *commitFileInfo) IsDir() bool {
	return false
}

func (cfi *commitFileInfo) Sys() interface{} {
	return nil
}
