// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// SyncFromServerFile represents a write-only file when any write of
// at least one byte triggers a sync of the folder from the server.
// A sync:
//
// - Waits for any outstanding conflict resolution tasks to finish
//   (and it fails if the TLF is still in staged mode after waiting for
//   CR).
// - Checks with the server for what the latest revision is for the folder.
// - Fetches and applies any missing revisions.
// - Waits for all outstanding block archive tasks to complete.
// - Waits for all outstanding quota reclamation tasks to complete.
type SyncFromServerFile struct {
	folder *Folder
}

var _ fs.Node = (*SyncFromServerFile)(nil)

// Attr implements the fs.Node interface for SyncFromServerFile.
func (f *SyncFromServerFile) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Size = 0
	a.Mode = 0222
	return nil
}

var _ fs.Handle = (*SyncFromServerFile)(nil)

var _ fs.HandleWriter = (*SyncFromServerFile)(nil)

// Write implements the fs.HandleWriter interface for SyncFromServerFile.
func (f *SyncFromServerFile) Write(ctx context.Context, req *fuse.WriteRequest,
	resp *fuse.WriteResponse) (err error) {
	f.folder.fs.log.CDebugf(ctx, "SyncFromServerFile Write")
	defer func() { err = f.folder.processError(ctx, libkbfs.WriteMode, err) }()
	if len(req.Data) == 0 {
		return nil
	}
	folderBranch := f.folder.getFolderBranch()
	if folderBranch == (data.FolderBranch{}) {
		// Nothing to do.
		resp.Size = len(req.Data)
		return nil
	}

	// Use a context with a nil CtxAppIDKey value so that
	// notifications generated from this sync won't be discarded.
	syncCtx := context.WithValue(ctx, libfs.CtxAppIDKey, nil)
	err = f.folder.fs.config.KBFSOps().SyncFromServer(
		syncCtx, folderBranch, nil)
	if err != nil {
		return err
	}
	f.folder.fs.NotificationGroupWait()
	resp.Size = len(req.Data)
	return nil
}
