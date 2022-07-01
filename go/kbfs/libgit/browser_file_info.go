// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"os"
	"time"

	"gopkg.in/src-d/go-git.v4/plumbing/object"
)

type browserFileInfo struct {
	entry *object.TreeEntry
	size  int64
	mtime time.Time
}

var _ os.FileInfo = (*browserFileInfo)(nil)

func (bfi *browserFileInfo) Name() string {
	return bfi.entry.Name
}

func (bfi *browserFileInfo) Size() int64 {
	return bfi.size
}

func (bfi *browserFileInfo) Mode() os.FileMode {
	mode, err := bfi.entry.Mode.ToOSFileMode()
	if err != nil {
		panic(err)
	}
	// Make it read-only.
	return mode &^ 0222
}

func (bfi *browserFileInfo) ModTime() time.Time {
	// Unfortunately go-git doesn't give us a good way to get the time
	// of this entry, so we have to rely on the caller.
	return bfi.mtime
}

func (bfi *browserFileInfo) IsDir() bool {
	return !bfi.entry.Mode.IsFile()
}

func (bfi *browserFileInfo) Sys() interface{} {
	return nil
}
