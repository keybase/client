package main

import (
	"log"
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// File represents KBFS files.
type File struct {
	fs.NodeRef

	parent   *Dir
	de       libkbfs.DirEntry
	pathNode libkbfs.PathNode
}

var _ fs.Node = (*File)(nil)

// Attr implements the fs.Node interface for File.
func (f *File) Attr(ctx context.Context, a *fuse.Attr) error {
	f.parent.folder.mu.RLock()
	defer f.parent.folder.mu.RUnlock()

	a.Size = f.de.Size
	a.Mtime = time.Unix(0, f.de.Mtime)
	a.Ctime = time.Unix(0, f.de.Ctime)
	a.Mode = 0644
	if f.de.Type == libkbfs.Exec {
		a.Mode |= 0111
	}
	return nil
}

func (f *File) getPathLocked() libkbfs.Path {
	p := f.parent.getPathLocked()
	p.Path = append(p.Path, f.pathNode)
	return p
}

// Update the PathNode stored here, and in parents.
//
// Caller is responsible for locking.
func (f *File) updatePathLocked(p libkbfs.Path) {
	pNode := p.Path[len(p.Path)-1]
	if f.pathNode.Name != pNode.Name {
		return
	}
	f.pathNode = pNode
	p.Path = p.Path[:len(p.Path)-1]
	f.parent.updatePathLocked(p)
}

var _ fs.NodeFsyncer = (*File)(nil)

func (f *File) sync(ctx context.Context) error {
	f.parent.folder.mu.Lock()
	defer f.parent.folder.mu.Unlock()

	p, err := f.parent.folder.fs.config.KBFSOps().Sync(f.getPathLocked())
	if err != nil {
		return err
	}
	f.updatePathLocked(p)

	// Update mtime and such to be what KBFS thinks they should be.
	// bazil.org/fuse does not currently tolerate attribute fetch
	// failing very well, and the kernel would have to flag such nodes
	// invalid, so we try to do failing operations in advance.
	pp := *p.ParentPath()
	dir, err := f.parent.folder.fs.config.KBFSOps().GetDir(pp)
	if err != nil {
		return err
	}
	if de, ok := dir.Children[f.pathNode.Name]; ok {
		f.de = de
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
	f.parent.folder.mu.RLock()
	defer f.parent.folder.mu.RUnlock()

	p := f.getPathLocked()
	n, err := f.parent.folder.fs.config.KBFSOps().Read(p, resp.Data[:cap(resp.Data)], req.Offset)
	resp.Data = resp.Data[:n]
	return err
}

var _ fs.HandleWriter = (*File)(nil)

// Write implements the fs.HandleWriter interface for File.
func (f *File) Write(ctx context.Context, req *fuse.WriteRequest, resp *fuse.WriteResponse) error {
	f.parent.folder.mu.Lock()
	defer f.parent.folder.mu.Unlock()

	p := f.getPathLocked()
	if err := f.parent.folder.fs.config.KBFSOps().Write(p, req.Data, req.Offset); err != nil {
		return err
	}
	resp.Size = len(req.Data)
	if size := uint64(resp.Size); f.de.Size < size {
		f.de.Size = size
	}
	// TODO should we bump up mtime and ctime, too?
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
		if err := f.parent.folder.fs.config.KBFSOps().Truncate(f.getPathLocked(), req.Size); err != nil {
			return err
		}
		f.de.Size = req.Size
		// TODO should we bump up mtime and ctime, too?
		// TODO update f.pathNode?
		valid &^= fuse.SetattrSize
	}

	if valid.Mode() {
		// Unix has 3 exec bits, KBFS has one; we follow the user-exec bit.
		exec := req.Mode&0100 != 0
		p, err := f.parent.folder.fs.config.KBFSOps().SetEx(f.getPathLocked(), exec)
		if err != nil {
			return err
		}
		f.updatePathLocked(p)
		if exec {
			f.de.Type = libkbfs.Exec
		} else {
			f.de.Type = libkbfs.File
		}
		// TODO should we bump up mtime and ctime, too?
		// TODO should we do GetDir instead?
		valid &^= fuse.SetattrMode
	}

	if valid.Mtime() {
		p, err := f.parent.folder.fs.config.KBFSOps().SetMtime(f.getPathLocked(), &req.Mtime)
		if err != nil {
			return err
		}
		f.updatePathLocked(p)
		f.de.Mtime = req.Mtime.UnixNano()
		// TODO should we bump up ctime, too?
		// TODO should we do GetDir instead?
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
