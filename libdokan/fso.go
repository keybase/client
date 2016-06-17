// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"sync/atomic"
	"time"

	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libkbfs"
)

// FSO is a common type for file system objects, i.e. Dirs or Files.
type FSO struct {
	refcount refcount
	name     string
	folder   *Folder
	node     libkbfs.Node
	parent   libkbfs.Node
	emptyFile
}

// SetFileTime sets mtime for FSOs (File and Dir). TLFs have a separate SetFileTime.
func (f *FSO) SetFileTime(fi *dokan.FileInfo, creation time.Time, lastAccess time.Time, lastWrite time.Time) (err error) {
	ctx, cancel := NewContextWithOpID(f.folder.fs, "FSO SetFileTime")
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err, cancel) }()
	f.folder.fs.log.CDebugf(ctx, "FSO SetFileTime %v %v %v", creation, lastAccess, lastWrite)

	if !lastWrite.IsZero() {
		return f.folder.fs.config.KBFSOps().SetMtime(ctx, f.node, &lastWrite)
	}

	return dokan.ErrNotSupported
}

type refcount struct {
	x int32
}

func (rc *refcount) Increase() {
	atomic.AddInt32(&rc.x, 1)
}

func (rc *refcount) Decrease() bool {
	return atomic.AddInt32(&rc.x, -1) == 0
}
