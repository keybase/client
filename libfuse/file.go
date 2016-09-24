// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"sync"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type eiCache struct {
	ei    libkbfs.EntryInfo
	reqID string
}

// eiCacheHolder caches the EntryInfo for a particular reqID. It's used for the
// Attr call after Create. This should only be used for operations with same
// reqID.
type eiCacheHolder struct {
	mu    sync.Mutex
	cache *eiCache
}

func (c *eiCacheHolder) destroy() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = nil
}

func (c *eiCacheHolder) getAndDestroyIfMatches(reqID string) (ei *libkbfs.EntryInfo) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.cache != nil && c.cache.reqID == reqID {
		ei = &c.cache.ei
		c.cache = nil
	}
	return ei
}

func (c *eiCacheHolder) set(reqID string, ei libkbfs.EntryInfo) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = &eiCache{
		ei:    ei,
		reqID: reqID,
	}
}

// File represents KBFS files.
type File struct {
	folder *Folder
	node   libkbfs.Node

	eiCache eiCacheHolder
}

var _ fs.Node = (*File)(nil)

func fillAttrWithMode(ei *libkbfs.EntryInfo, a *fuse.Attr) {
	fillAttr(ei, a)
	a.Mode = 0644
	if ei.Type == libkbfs.Exec {
		a.Mode |= 0111
	}
}

// Attr implements the fs.Node interface for File.
func (f *File) Attr(ctx context.Context, a *fuse.Attr) (err error) {
	f.folder.fs.log.CDebugf(ctx, "File Attr")
	defer func() { f.folder.reportErr(ctx, libkbfs.ReadMode, err) }()

	if reqID, ok := ctx.Value(CtxIDKey).(string); ok {
		if ei := f.eiCache.getAndDestroyIfMatches(reqID); ei != nil {
			fillAttrWithMode(ei, a)
			return nil
		}
	}

	// This fits in situation 1 as described in libkbfs/delayed_cancellation.go
	err = libkbfs.EnableDelayedCancellationWithGracePeriod(
		ctx, f.folder.fs.config.DelayedCancellationGracePeriod())
	if err != nil {
		return err
	}

	return f.attr(ctx, a)
}

func (f *File) attr(ctx context.Context, a *fuse.Attr) (err error) {
	de, err := f.folder.fs.config.KBFSOps().Stat(ctx, f.node)
	if err != nil {
		if isNoSuchNameError(err) {
			return fuse.ESTALE
		}
		return err
	}

	fillAttrWithMode(&de, a)
	return nil
}

var _ fs.NodeFsyncer = (*File)(nil)

func (f *File) sync(ctx context.Context) error {
	f.eiCache.destroy()
	err := f.folder.fs.config.KBFSOps().Sync(ctx, f.node)
	if err != nil {
		return err
	}

	return nil
}

// Fsync implements the fs.NodeFsyncer interface for File.
func (f *File) Fsync(ctx context.Context, req *fuse.FsyncRequest) (err error) {
	f.folder.fs.log.CDebugf(ctx, "File Fsync")
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err) }()

	// This fits in situation 1 as described in libkbfs/delayed_cancellation.go
	err = libkbfs.EnableDelayedCancellationWithGracePeriod(
		ctx, f.folder.fs.config.DelayedCancellationGracePeriod())
	if err != nil {
		return err
	}

	return f.sync(ctx)
}

var _ fs.Handle = (*File)(nil)

var _ fs.HandleReader = (*File)(nil)

// Read implements the fs.HandleReader interface for File.
func (f *File) Read(ctx context.Context, req *fuse.ReadRequest,
	resp *fuse.ReadResponse) (err error) {
	f.folder.fs.log.CDebugf(ctx, "File Read")
	defer func() { f.folder.reportErr(ctx, libkbfs.ReadMode, err) }()

	n, err := f.folder.fs.config.KBFSOps().Read(
		ctx, f.node, resp.Data[:cap(resp.Data)], req.Offset)
	if err != nil {
		return err
	}
	resp.Data = resp.Data[:n]
	return nil
}

var _ fs.HandleWriter = (*File)(nil)

// Write implements the fs.HandleWriter interface for File.
func (f *File) Write(ctx context.Context, req *fuse.WriteRequest,
	resp *fuse.WriteResponse) (err error) {
	f.folder.fs.log.CDebugf(ctx, "File Write sz=%d ", len(req.Data))
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err) }()

	f.eiCache.destroy()
	if err := f.folder.fs.config.KBFSOps().Write(
		ctx, f.node, req.Data, req.Offset); err != nil {
		return err
	}
	resp.Size = len(req.Data)
	return nil
}

var _ fs.HandleFlusher = (*File)(nil)

// Flush implements the fs.HandleFlusher interface for File.
func (f *File) Flush(ctx context.Context, req *fuse.FlushRequest) (err error) {
	f.folder.fs.log.CDebugf(ctx, "File Flush")
	// I'm not sure about the guarantees from KBFSOps, so we don't
	// differentiate between Flush and Fsync.
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err) }()

	// This fits in situation 1 as described in libkbfs/delayed_cancellation.go
	err = libkbfs.EnableDelayedCancellationWithGracePeriod(
		ctx, f.folder.fs.config.DelayedCancellationGracePeriod())
	if err != nil {
		return err
	}

	return f.sync(ctx)
}

var _ fs.NodeSetattrer = (*File)(nil)

// Setattr implements the fs.NodeSetattrer interface for File.
func (f *File) Setattr(ctx context.Context, req *fuse.SetattrRequest,
	resp *fuse.SetattrResponse) (err error) {
	f.folder.fs.log.CDebugf(ctx, "File SetAttr")
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err) }()

	f.eiCache.destroy()

	valid := req.Valid
	if valid.Size() {
		if err := f.folder.fs.config.KBFSOps().Truncate(
			ctx, f.node, req.Size); err != nil {
			return err
		}
		if !req.Valid.Handle() {
			// This is a truncate (as opposed to an ftruncate), and so
			// we can't expect a later file close.  So just sync the
			// file now.
			if err := f.folder.fs.config.KBFSOps().Sync(
				ctx, f.node); err != nil {
				return err
			}
		}
		valid &^= fuse.SetattrSize
	}

	if valid.Mode() {
		// Unix has 3 exec bits, KBFS has one; we follow the user-exec bit.
		exec := req.Mode&0100 != 0
		err := f.folder.fs.config.KBFSOps().SetEx(
			ctx, f.node, exec)
		if err != nil {
			return err
		}
		valid &^= fuse.SetattrMode
	}

	if valid.Mtime() {
		err := f.folder.fs.config.KBFSOps().SetMtime(
			ctx, f.node, &req.Mtime)
		if err != nil {
			return err
		}
		valid &^= fuse.SetattrMtime | fuse.SetattrMtimeNow
	}

	if valid.Uid() || valid.Gid() {
		// You can't set the UID/GID on KBFS files, but we don't want
		// to return ENOSYS because that causes scary warnings on some
		// programs like mv.  Instead ignore it, print a debug
		// message, and advertise this behavior on the
		// "understand_kbfs" doc online.
		f.folder.fs.log.CDebugf(ctx, "Ignoring unsupported attempt to set "+
			"the UID/GID on a file")
		valid &^= fuse.SetattrUid | fuse.SetattrGid
	}

	// KBFS has no concept of persistent atime; explicitly don't handle it
	valid &^= fuse.SetattrAtime | fuse.SetattrAtimeNow

	// things we don't need to explicitly handle
	valid &^= fuse.SetattrLockOwner | fuse.SetattrHandle

	// KBFS has no concept of chflags(2); explicitly ignore those
	valid &^= fuse.SetattrFlags

	if valid != 0 {
		// don't let an unhandled operation slip by without error
		f.folder.fs.log.CInfof(ctx, "Setattr did not handle %v", valid)
		return fuse.ENOSYS
	}

	if err := f.attr(ctx, &resp.Attr); err != nil {
		return err
	}
	return nil
}

var _ fs.NodeForgetter = (*File)(nil)

// Forget kernel reference to this node.
func (f *File) Forget() {
	f.eiCache.destroy()
	f.folder.forgetNode(f.node)
}
