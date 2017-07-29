// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// SyncControlFile is a special file used to control sync
// settings.
type SyncControlFile struct {
	folder *Folder
	action libfs.SyncAction
}

var _ fs.Node = (*SyncControlFile)(nil)

// Attr implements the fs.Node interface for SyncControlFile.
func (f *SyncControlFile) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Size = 0
	a.Mode = 0222
	return nil
}

var _ fs.Handle = (*SyncControlFile)(nil)

var _ fs.HandleWriter = (*SyncControlFile)(nil)

// Write implements the fs.HandleWriter interface for SyncControlFile.
func (f *SyncControlFile) Write(ctx context.Context, req *fuse.WriteRequest,
	resp *fuse.WriteResponse) (err error) {
	f.folder.fs.log.CDebugf(ctx, "SyncControlFile (f.action=%s) Write",
		f.action)
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err) }()
	if len(req.Data) == 0 {
		return nil
	}

	err = f.action.Execute(
		ctx, f.folder.fs.config, f.folder.getFolderBranch(), f.folder.h)
	if err != nil {
		return err
	}

	resp.Size = len(req.Data)
	return nil
}
