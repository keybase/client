// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"errors"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// UpdatesFile represents a write-only file where any write of at
// least one byte triggers either disabling remote folder updates and
// conflict resolution, or re-enabling both.  It is mainly useful for
// testing.
type UpdatesFile struct {
	folder *Folder
	enable bool
}

var _ fs.Node = (*UpdatesFile)(nil)

// Attr implements the fs.Node interface for UpdatesFile.
func (f *UpdatesFile) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Size = 0
	a.Mode = 0222
	return nil
}

var _ fs.Handle = (*UpdatesFile)(nil)

var _ fs.HandleWriter = (*UpdatesFile)(nil)

// Write implements the fs.HandleWriter interface for UpdatesFile.
func (f *UpdatesFile) Write(ctx context.Context, req *fuse.WriteRequest,
	resp *fuse.WriteResponse) (err error) {
	f.folder.fs.log.CDebugf(ctx, "UpdatesFile (enable: %t) Write", f.enable)
	defer func() { err = f.folder.processError(ctx, libkbfs.WriteMode, err) }()
	if len(req.Data) == 0 {
		return nil
	}

	f.folder.updateMu.Lock()
	defer f.folder.updateMu.Unlock()
	if f.enable {
		if f.folder.updateChan == nil {
			return errors.New("Updates are already enabled")
		}
		err = libkbfs.RestartCRForTesting(
			libcontext.BackgroundContextWithCancellationDelayer(),
			f.folder.fs.config, f.folder.getFolderBranch())
		if err != nil {
			return err
		}
		f.folder.updateChan <- struct{}{}
		close(f.folder.updateChan)
		f.folder.updateChan = nil
	} else {
		if f.folder.updateChan != nil {
			return errors.New("Updates are already disabled")
		}
		f.folder.updateChan, err =
			libkbfs.DisableUpdatesForTesting(f.folder.fs.config,
				f.folder.getFolderBranch())
		if err != nil {
			return err
		}
		err = libkbfs.DisableCRForTesting(f.folder.fs.config,
			f.folder.getFolderBranch())
		if err != nil {
			return err
		}
	}

	resp.Size = len(req.Data)
	return nil
}
