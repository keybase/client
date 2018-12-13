// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// UnstageFile represents a write-only file when any write of at least
// one byte triggers unstaging all unmerged commits and
// fast-forwarding to the current master.
type UnstageFile struct {
	folder *Folder
}

var _ fs.Node = (*UnstageFile)(nil)

// Attr implements the fs.Node interface for UnstageFile.
func (f *UnstageFile) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Size = 0
	a.Mode = 0222
	return nil
}

var _ fs.Handle = (*UnstageFile)(nil)

var _ fs.HandleWriter = (*UnstageFile)(nil)

// Write implements the fs.HandleWriter interface for UnstageFile.
func (f *UnstageFile) Write(ctx context.Context, req *fuse.WriteRequest,
	resp *fuse.WriteResponse) (err error) {
	defer func() { err = f.folder.processError(ctx, libkbfs.WriteMode, err) }()
	size, err := libfs.UnstageForTesting(
		ctx, f.folder.fs.log, f.folder.fs.config,
		f.folder.getFolderBranch(), req.Data)
	if err != nil {
		return err
	}
	resp.Size = size
	return nil
}
