package main

import (
	"log"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// File represents KBFS files.
type File struct {
	fs.NodeRef

	parent *Dir
	node   libkbfs.Node
}

var _ fs.Node = (*File)(nil)

// Attr implements the fs.Node interface for File.
func (f *File) Attr(ctx context.Context, a *fuse.Attr) error {
	f.parent.folder.mu.Lock()
	defer f.parent.folder.mu.Unlock()

	de, err := f.parent.folder.fs.config.KBFSOps().Stat(ctx, f.node)
	if err != nil {
		if _, ok := err.(libkbfs.NoSuchNameError); ok {
			return fuse.ESTALE
		}
		return err
	}

	fillAttr(&de, a)
	a.Mode = 0644
	if de.Type == libkbfs.Exec {
		a.Mode |= 0111
	}
	return nil
}

var _ fs.NodeFsyncer = (*File)(nil)

func (f *File) sync(ctx context.Context) error {
	f.parent.folder.mu.Lock()
	defer f.parent.folder.mu.Unlock()

	err := f.parent.folder.fs.config.KBFSOps().Sync(ctx, f.node)
	if err != nil {
		return err
	}

	return nil
}

// Fsync implements the fs.NodeFsyncer interface for File.
func (f *File) Fsync(ctx context.Context, req *fuse.FsyncRequest) error {
	return f.sync(ctx)
}

var _ fs.Handle = (*File)(nil)

var _ fs.HandleReader = (*File)(nil)

// Read implements the fs.HandleReader interface for File.
func (f *File) Read(ctx context.Context, req *fuse.ReadRequest, resp *fuse.ReadResponse) error {
	f.parent.folder.mu.Lock()
	defer f.parent.folder.mu.Unlock()

	n, err := f.parent.folder.fs.config.KBFSOps().Read(
		ctx, f.node, resp.Data[:cap(resp.Data)], req.Offset)
	resp.Data = resp.Data[:n]
	return err
}

var _ fs.HandleWriter = (*File)(nil)

// Write implements the fs.HandleWriter interface for File.
func (f *File) Write(ctx context.Context, req *fuse.WriteRequest, resp *fuse.WriteResponse) error {
	f.parent.folder.mu.Lock()
	defer f.parent.folder.mu.Unlock()

	if err := f.parent.folder.fs.config.KBFSOps().Write(
		ctx, f.node, req.Data, req.Offset); err != nil {
		return err
	}
	resp.Size = len(req.Data)
	return nil
}

var _ fs.HandleFlusher = (*File)(nil)

// Flush implements the fs.HandleFlusher interface for File.
func (f *File) Flush(ctx context.Context, req *fuse.FlushRequest) error {
	// I'm not sure about the guarantees from KBFSOps, so we don't
	// differentiate between Flush and Fsync.
	return f.sync(ctx)
}

var _ fs.NodeSetattrer = (*File)(nil)

// Setattr implements the fs.NodeSetattrer interface for File.
func (f *File) Setattr(ctx context.Context, req *fuse.SetattrRequest, resp *fuse.SetattrResponse) error {
	f.parent.folder.mu.Lock()
	defer f.parent.folder.mu.Unlock()

	valid := req.Valid
	if valid.Size() {
		if err := f.parent.folder.fs.config.KBFSOps().Truncate(
			ctx, f.node, req.Size); err != nil {
			return err
		}
		valid &^= fuse.SetattrSize
	}

	if valid.Mode() {
		// Unix has 3 exec bits, KBFS has one; we follow the user-exec bit.
		exec := req.Mode&0100 != 0
		err := f.parent.folder.fs.config.KBFSOps().SetEx(
			ctx, f.node, exec)
		if err != nil {
			return err
		}
		valid &^= fuse.SetattrMode
	}

	if valid.Mtime() {
		err := f.parent.folder.fs.config.KBFSOps().SetMtime(
			ctx, f.node, &req.Mtime)
		if err != nil {
			return err
		}
		valid &^= fuse.SetattrMtime
	}

	// KBFS has no concept of persistent atime; explicitly don't handle it
	valid &^= fuse.SetattrAtime

	// things we don't need to explicitly handle
	valid &^= fuse.SetattrLockOwner | fuse.SetattrHandle

	if valid != 0 {
		// don't let an unhandled operation slip by without error
		log.Printf("Setattr did not handle %v", valid)
		return fuse.ENOSYS
	}
	return nil
}

var _ fs.NodeForgetter = (*File)(nil)

// Forget kernel reference to this node.
func (f *File) Forget() {
	f.parent.folder.mu.Lock()
	defer f.parent.folder.mu.Unlock()

	name := f.node.GetBasename()
	if name == "" {
		// unlinked
		return
	}
	f.parent.forgetChildLocked(f, name)
}

var _ folderNode = (*File)(nil)

// KBFSNodeID returns the libkbfs.NodeID for this node, for use in
// libkbfs change notification callbacks.
func (f *File) KBFSNodeID() libkbfs.NodeID {
	return f.node.GetID()
}
