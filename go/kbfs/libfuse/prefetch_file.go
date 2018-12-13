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

// PrefetchFile represents a write-only file where any write of at least one
// byte triggers either disabling or enabling prefetching.  It is mainly useful
// for testing.
type PrefetchFile struct {
	fs     *FS
	enable bool
}

var _ fs.Node = (*PrefetchFile)(nil)

// Attr implements the fs.Node interface for PrefetchFile.
func (f *PrefetchFile) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Size = 0
	a.Mode = 0222
	return nil
}

var _ fs.Handle = (*PrefetchFile)(nil)

var _ fs.HandleWriter = (*PrefetchFile)(nil)

// Write implements the fs.HandleWriter interface for PrefetchFile.
func (f *PrefetchFile) Write(ctx context.Context, req *fuse.WriteRequest,
	resp *fuse.WriteResponse) (err error) {
	f.fs.log.CDebugf(ctx, "PrefetchFile (enable: %t) Write", f.enable)
	defer func() { err = f.fs.processError(ctx, libkbfs.WriteMode, err) }()
	if len(req.Data) == 0 {
		return nil
	}

	f.fs.config.BlockOps().TogglePrefetcher(f.enable)

	resp.Size = len(req.Data)
	return nil
}
