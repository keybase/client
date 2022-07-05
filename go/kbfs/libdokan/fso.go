// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"sync/atomic"
	"time"

	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// FSO is a common type for file system objects, i.e. Dirs or Files.
type FSO struct {
	refcount refcount // nolint -- it's used when embedded in dir/file
	name     string
	folder   *Folder
	node     libkbfs.Node
	parent   libkbfs.Node
	emptyFile
}

// SetFileTime sets mtime for FSOs (File and Dir). TLFs have a separate SetFileTime.
func (f *FSO) SetFileTime(ctx context.Context, fi *dokan.FileInfo, creation time.Time, lastAccess time.Time, lastWrite time.Time) (err error) {
	f.folder.fs.logEnter(ctx, "FSO SetFileTime")
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err) }()
	f.folder.fs.log.CDebugf(ctx, "FSO SetFileTime %v %v %v", creation, lastAccess, lastWrite)

	if !lastWrite.IsZero() {
		return f.folder.fs.config.KBFSOps().SetMtime(ctx, f.node, &lastWrite)
	}

	return nil
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
