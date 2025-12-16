// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"context"

	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
)

// UnstageFile represents a write-only file when any write of at least
// one byte triggers unstaging all unmerged commits and
// fast-forwarding to the current master.
type UnstageFile struct {
	folder *Folder
	specialWriteFile
}

// WriteFile implements writes for dokan.
func (f *UnstageFile) WriteFile(ctx context.Context, fi *dokan.FileInfo, bs []byte, offset int64) (n int, err error) {
	f.folder.fs.logEnter(ctx, "UnstageFile WriteFile")
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err) }()
	return libfs.UnstageForTesting(
		ctx, f.folder.fs.log, f.folder.fs.config,
		f.folder.getFolderBranch(), bs)
}
