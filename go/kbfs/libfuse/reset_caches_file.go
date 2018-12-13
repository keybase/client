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

// ResetCachesFile represents a write-only file where any write of at
// least one byte triggers the resetting of all data caches.  It can
// be reached from any directory under the FUSE mountpoint.  Note that
// it does not clear the *node* cache, which means that the
// BlockPointers for existing nodes are still cached, such that
// directory listings can still be implicitly cached for nodes still
// being held by the kernel.
type ResetCachesFile struct {
	fs *FS
}

var _ fs.Node = (*ResetCachesFile)(nil)

// Attr implements the fs.Node interface for ResetCachesFile.
func (f *ResetCachesFile) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Size = 0
	a.Mode = 0222
	return nil
}

var _ fs.Handle = (*ResetCachesFile)(nil)

var _ fs.HandleWriter = (*ResetCachesFile)(nil)

// Write implements the fs.HandleWriter interface for ResetCachesFile.
func (f *ResetCachesFile) Write(ctx context.Context, req *fuse.WriteRequest,
	resp *fuse.WriteResponse) (err error) {
	f.fs.log.CDebugf(ctx, "ResetCachesFile Write")
	defer func() { err = f.fs.processError(ctx, libkbfs.WriteMode, err) }()
	if len(req.Data) == 0 {
		return nil
	}
	f.fs.config.ResetCaches()
	resp.Size = len(req.Data)
	return nil
}
