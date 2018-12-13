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

// RekeyFile represents a write-only file when any write of at least
// one byte triggers a rekey of the folder.
type RekeyFile struct {
	folder *Folder
}

var _ fs.Node = (*RekeyFile)(nil)

// Attr implements the fs.Node interface for RekeyFile.
func (f *RekeyFile) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Size = 0
	a.Mode = 0222
	return nil
}

var _ fs.Handle = (*RekeyFile)(nil)

var _ fs.HandleWriter = (*RekeyFile)(nil)

// Write implements the fs.HandleWriter interface for RekeyFile.
func (f *RekeyFile) Write(ctx context.Context, req *fuse.WriteRequest,
	resp *fuse.WriteResponse) (err error) {
	f.folder.fs.log.CDebugf(ctx, "RekeyFile Write")
	defer func() { err = f.folder.processError(ctx, libkbfs.WriteMode, err) }()
	if len(req.Data) == 0 {
		return nil
	}
	_, err = libkbfs.RequestRekeyAndWaitForOneFinishEvent(ctx,
		f.folder.fs.config.KBFSOps(), f.folder.getFolderBranch().Tlf)
	if err != nil {
		return err
	}
	f.folder.fs.NotificationGroupWait()
	resp.Size = len(req.Data)
	return nil
}
