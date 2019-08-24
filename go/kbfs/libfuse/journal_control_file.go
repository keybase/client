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

// JournalControlFile is a special file used to control journal
// settings.
type JournalControlFile struct {
	folder *Folder
	action libfs.JournalAction
}

var _ fs.Node = (*JournalControlFile)(nil)

// Attr implements the fs.Node interface for JournalControlFile.
func (f *JournalControlFile) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Size = 0
	a.Mode = 0222
	return nil
}

var _ fs.Handle = (*JournalControlFile)(nil)

var _ fs.HandleWriter = (*JournalControlFile)(nil)

// Write implements the fs.HandleWriter interface for JournalControlFile.
func (f *JournalControlFile) Write(ctx context.Context, req *fuse.WriteRequest,
	resp *fuse.WriteResponse) (err error) {
	f.folder.fs.log.CDebugf(ctx, "JournalControlFile (f.action=%s) Write",
		f.action)
	defer func() { err = f.folder.processError(ctx, libkbfs.WriteMode, err) }()
	if len(req.Data) == 0 {
		return nil
	}

	jManager, err := libkbfs.GetJournalManager(f.folder.fs.config)
	if err != nil {
		return err
	}

	err = f.action.Execute(
		ctx, jManager, f.folder.getFolderBranch().Tlf, f.folder.h)
	if err != nil {
		return err
	}

	resp.Size = len(req.Data)
	return nil
}
