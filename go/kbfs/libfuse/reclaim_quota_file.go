// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// ReclaimQuotaFile represents a write-only file when any write of at
// least one byte triggers a quota reclamation of the folder.
type ReclaimQuotaFile struct {
	folder *Folder
}

var _ fs.Node = (*ReclaimQuotaFile)(nil)

// Attr implements the fs.Node interface for ReclaimQuotaFile.
func (f *ReclaimQuotaFile) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Size = 0
	a.Mode = 0222
	return nil
}

var _ fs.Handle = (*ReclaimQuotaFile)(nil)

var _ fs.HandleWriter = (*ReclaimQuotaFile)(nil)

// Write implements the fs.HandleWriter interface for
// ReclaimQuotaFile.  Note a write triggers quota reclamation, but
// does not wait for it to finish. If you want to wait, write to
// SyncFromServerFileName.
func (f *ReclaimQuotaFile) Write(ctx context.Context, req *fuse.WriteRequest,
	resp *fuse.WriteResponse) (err error) {
	f.folder.fs.log.CDebugf(ctx, "ReclaimQuotaFile Write")
	defer func() { err = f.folder.processError(ctx, libkbfs.WriteMode, err) }()
	if len(req.Data) == 0 {
		return nil
	}
	err = libkbfs.ForceQuotaReclamationForTesting(
		f.folder.fs.config, f.folder.getFolderBranch())
	if err != nil {
		return err
	}
	resp.Size = len(req.Data)
	return nil
}
