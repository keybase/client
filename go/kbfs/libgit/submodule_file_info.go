// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"os"
	"time"
)

type submoduleFileInfo struct {
	name  string
	size  int64
	mtime time.Time
	sf    *submoduleFile
}

var _ os.FileInfo = (*submoduleFileInfo)(nil)

func (sfi *submoduleFileInfo) Name() string {
	return sfi.name
}

func (sfi *submoduleFileInfo) Size() int64 {
	return sfi.size
}

func (sfi *submoduleFileInfo) Mode() os.FileMode {
	// Make it read-only.
	return 0600
}

func (sfi *submoduleFileInfo) ModTime() time.Time {
	return sfi.mtime
}

func (sfi *submoduleFileInfo) IsDir() bool {
	return false
}

func (sfi *submoduleFileInfo) Sys() interface{} {
	return nil
}
