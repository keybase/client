// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libkbfs"
)

// FSO is a common type for file system objects, i.e. Dirs or Files.
type FSO struct {
	name   string
	folder *Folder
	node   libkbfs.Node
	parent libkbfs.Node
	emptyFile
}

// SetFileTime sets mtime for FSOs (File and Dir).
func (f *FSO) SetFileTime(fi *dokan.FileInfo, creation time.Time, lastAccess time.Time, lastWrite time.Time) (err error) {
	ctx := context.TODO()
	ctx = NewContextWithOpID(ctx, f.folder.fs.log)
	f.folder.fs.log.CDebugf(ctx, "FSO SetFileTime")
	defer func() { f.folder.fs.reportErr(ctx, err) }()

	if !lastWrite.IsZero() {
		return f.folder.fs.config.KBFSOps().SetMtime(ctx, f.node, &lastWrite)
	}

	return dokan.ErrNotSupported
}
