// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"fmt"
	"os"
	"sync"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type eiCache struct {
	ei    data.EntryInfo
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

func (c *eiCacheHolder) getAndDestroyIfMatches(reqID string) (ei *data.EntryInfo) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.cache != nil && c.cache.reqID == reqID {
		ei = &c.cache.ei
		c.cache = nil
	}
	return ei
}

func (c *eiCacheHolder) set(reqID string, ei data.EntryInfo) {
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
	inode  uint64
	XattrHandler

	eiCache eiCacheHolder
}

var _ fs.Node = (*File)(nil)

func (f *File) fillAttrWithMode(
	ctx context.Context, ei *data.EntryInfo, a *fuse.Attr) (err error) {
	if err = f.folder.fillAttrWithUIDAndWritePerm(
		ctx, f.node, ei, a); err != nil {
		return err
	}
	a.Mode |= 0400
	if ei.Type == data.Exec {
		a.Mode |= 0100
	}

	a.Inode = f.inode
	return nil
}

// Attr implements the fs.Node interface for File.
func (f *File) Attr(ctx context.Context, a *fuse.Attr) (err error) {
	ctx = f.folder.fs.config.MaybeStartTrace(
		ctx, "File.Attr", f.node.GetBasename().String())
	defer func() { f.folder.fs.config.MaybeFinishTrace(ctx, err) }()

	f.folder.fs.vlog.CLogf(ctx, libkb.VLog1, "File Attr")
	defer func() { err = f.folder.processError(ctx, libkbfs.ReadMode, err) }()

	if reqID, ok := ctx.Value(CtxIDKey).(string); ok {
		if ei := f.eiCache.getAndDestroyIfMatches(reqID); ei != nil {
			return f.fillAttrWithMode(ctx, ei, a)
		}
	}

	// This fits in situation 1 as described in libkbfs/delayed_cancellation.go
	err = libcontext.EnableDelayedCancellationWithGracePeriod(
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

	f.node.FillCacheDuration(&a.Valid)

	return f.fillAttrWithMode(ctx, &de, a)
}

var _ fs.NodeAccesser = (*File)(nil)

// Access implements the fs.NodeAccesser interface for File. This is necessary
// for macOS to correctly identify plaintext files as plaintext. If not
// implemented, bazil-fuse returns a nil error for every call, so when macOS
// checks for executable bit using Access (instead of Attr!), it gets a
// success, which makes it think the file is executable, yielding a "Unix
// executable" UTI.
func (f *File) Access(ctx context.Context, r *fuse.AccessRequest) (err error) {
	ctx = f.folder.fs.config.MaybeStartTrace(
		ctx, "File.Access", f.node.GetBasename().String())
	defer func() { f.folder.fs.config.MaybeFinishTrace(ctx, err) }()

	if int(r.Uid) != os.Getuid() &&
		// Finder likes to use UID 0 for some operations. osxfuse already allows
		// ACCESS and GETXATTR requests from root to go through. This allows root
		// in ACCESS handler. See KBFS-1733 for more details.
		int(r.Uid) != 0 {
		// short path: not accessible by anybody other than root or the user who
		// executed the kbfsfuse process.
		return fuse.EPERM
	}

	if r.Mask&03 == 0 {
		// Since we only check for w and x bits, we can return nil early here.
		return nil
	}

	if r.Mask&01 != 0 {
		ei, err := f.folder.fs.config.KBFSOps().Stat(ctx, f.node)
		if err != nil {
			if isNoSuchNameError(err) {
				return fuse.ESTALE
			}
			return err
		}
		if ei.Type != data.Exec {
			return fuse.EPERM
		}
	}

	if r.Mask&02 != 0 {
		iw, err := f.folder.isWriter(ctx)
		if err != nil {
			return err
		}
		if !iw {
			return fuse.EPERM
		}
	}

	return nil
}

var _ fs.NodeFsyncer = (*File)(nil)

func (f *File) sync(ctx context.Context) error {
	f.eiCache.destroy()
	err := f.folder.fs.config.KBFSOps().SyncAll(ctx, f.node.GetFolderBranch())
	if err != nil {
		return err
	}

	return nil
}

// Fsync implements the fs.NodeFsyncer interface for File.
func (f *File) Fsync(ctx context.Context, req *fuse.FsyncRequest) (err error) {
	ctx = f.folder.fs.config.MaybeStartTrace(
		ctx, "File.Fsync", f.node.GetBasename().String())
	defer func() { f.folder.fs.config.MaybeFinishTrace(ctx, err) }()

	f.folder.fs.vlog.CLogf(ctx, libkb.VLog1, "File Fsync")
	defer func() { err = f.folder.processError(ctx, libkbfs.WriteMode, err) }()

	// This fits in situation 1 as described in libkbfs/delayed_cancellation.go
	err = libcontext.EnableDelayedCancellationWithGracePeriod(
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
	off := req.Offset
	sz := cap(resp.Data)
	ctx = f.folder.fs.config.MaybeStartTrace(ctx, "File.Read",
		fmt.Sprintf("%s off=%d sz=%d", f.node.GetBasename(), off, sz))
	defer func() { f.folder.fs.config.MaybeFinishTrace(ctx, err) }()

	f.folder.fs.vlog.CLogf(ctx, libkb.VLog1, "File Read off=%d sz=%d", off, sz)
	defer func() { err = f.folder.processError(ctx, libkbfs.ReadMode, err) }()

	n, err := f.folder.fs.config.KBFSOps().Read(
		ctx, f.node, resp.Data[:sz], off)
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
	sz := len(req.Data)
	ctx = f.folder.fs.config.MaybeStartTrace(ctx, "File.Write",
		fmt.Sprintf("%s sz=%d", f.node.GetBasename(), sz))
	defer func() { f.folder.fs.config.MaybeFinishTrace(ctx, err) }()

	f.folder.fs.vlog.CLogf(ctx, libkb.VLog1, "File Write sz=%d ", sz)
	defer func() { err = f.folder.processError(ctx, libkbfs.WriteMode, err) }()

	f.eiCache.destroy()
	if err := f.folder.fs.config.KBFSOps().Write(
		ctx, f.node, req.Data, req.Offset); err != nil {
		return err
	}
	resp.Size = len(req.Data)
	return nil
}

var _ fs.NodeSetattrer = (*File)(nil)

// Setattr implements the fs.NodeSetattrer interface for File.
func (f *File) Setattr(ctx context.Context, req *fuse.SetattrRequest,
	resp *fuse.SetattrResponse) (err error) {
	valid := req.Valid
	ctx = f.folder.fs.config.MaybeStartTrace(ctx, "File.SetAttr",
		fmt.Sprintf("%s %s", f.node.GetBasename(), valid))
	defer func() { f.folder.fs.config.MaybeFinishTrace(ctx, err) }()

	f.folder.fs.vlog.CLogf(ctx, libkb.VLog1, "File SetAttr %s", valid)
	defer func() { err = f.folder.processError(ctx, libkbfs.WriteMode, err) }()

	f.eiCache.destroy()

	if valid.Size() {
		if err := f.folder.fs.config.KBFSOps().Truncate(
			ctx, f.node, req.Size); err != nil {
			return err
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
		f.folder.fs.vlog.CLogf(
			ctx, libkb.VLog1, "Ignoring unsupported attempt to set "+
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

	return f.attr(ctx, &resp.Attr)
}

var _ fs.NodeForgetter = (*File)(nil)

// Forget kernel reference to this node.
func (f *File) Forget() {
	f.eiCache.destroy()
	f.folder.forgetNode(f.node)
}
