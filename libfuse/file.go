package libfuse

import (
	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// File represents KBFS files.
type File struct {
	folder *Folder
	node   libkbfs.Node
}

var _ fs.Node = (*File)(nil)

// Attr implements the fs.Node interface for File.
func (f *File) Attr(ctx context.Context, a *fuse.Attr) (err error) {
	ctx = NewContextWithOpID(ctx, f.folder.fs.log)
	f.folder.fs.log.CDebugf(ctx, "File Attr")
	defer func() { f.folder.fs.reportErr(ctx, err) }()

	return f.attr(ctx, a)
}

func (f *File) attr(ctx context.Context, a *fuse.Attr) (err error) {
	de, err := f.folder.fs.config.KBFSOps().Stat(ctx, f.node)
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
	err := f.folder.fs.config.KBFSOps().Sync(ctx, f.node)
	if err != nil {
		return err
	}

	return nil
}

// Fsync implements the fs.NodeFsyncer interface for File.
func (f *File) Fsync(ctx context.Context, req *fuse.FsyncRequest) (err error) {
	ctx = NewContextWithOpID(ctx, f.folder.fs.log)
	f.folder.fs.log.CDebugf(ctx, "File Fsync")
	defer func() { f.folder.fs.reportErr(ctx, err) }()
	return f.sync(ctx)
}

var _ fs.Handle = (*File)(nil)

var _ fs.HandleReader = (*File)(nil)

// Read implements the fs.HandleReader interface for File.
func (f *File) Read(ctx context.Context, req *fuse.ReadRequest,
	resp *fuse.ReadResponse) (err error) {
	ctx = NewContextWithOpID(ctx, f.folder.fs.log)
	f.folder.fs.log.CDebugf(ctx, "File Read")
	defer func() { f.folder.fs.reportErr(ctx, err) }()

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
	ctx = NewContextWithOpID(ctx, f.folder.fs.log)
	f.folder.fs.log.CDebugf(ctx, "File Write")
	defer func() { f.folder.fs.reportErr(ctx, err) }()

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
	ctx = NewContextWithOpID(ctx, f.folder.fs.log)
	f.folder.fs.log.CDebugf(ctx, "File Flush")
	// I'm not sure about the guarantees from KBFSOps, so we don't
	// differentiate between Flush and Fsync.
	defer func() { f.folder.fs.reportErr(ctx, err) }()
	return f.sync(ctx)
}

var _ fs.NodeSetattrer = (*File)(nil)

// Setattr implements the fs.NodeSetattrer interface for File.
func (f *File) Setattr(ctx context.Context, req *fuse.SetattrRequest,
	resp *fuse.SetattrResponse) (err error) {
	ctx = NewContextWithOpID(ctx, f.folder.fs.log)
	f.folder.fs.log.CDebugf(ctx, "File SetAttr")
	defer func() { f.folder.fs.reportErr(ctx, err) }()

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

	// KBFS has no concept of persistent atime; explicitly don't handle it
	valid &^= fuse.SetattrAtime | fuse.SetattrAtimeNow

	// things we don't need to explicitly handle
	valid &^= fuse.SetattrLockOwner | fuse.SetattrHandle

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
	f.folder.forgetNode(f.node)
}
