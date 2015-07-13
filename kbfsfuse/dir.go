package main

import (
	"fmt"
	"os"
	"sync"
	"syscall"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// Folder represents KBFS top-level folders
type Folder struct {
	fs *FS
	id libkbfs.TlfID
	dh *libkbfs.TlfHandle

	// Protects all Dir.pathNode and File.pathNode instances.
	mu sync.RWMutex
}

// Dir represents KBFS subdirectories.
type Dir struct {
	fs.NodeRef

	folder *Folder
	parent *Dir
	node   libkbfs.Node
}

func newDir(folder *Folder, node libkbfs.Node, parent *Dir) *Dir {
	d := &Dir{
		folder: folder,
		parent: parent,
		node:   node,
	}
	return d
}

var _ fs.Node = (*Dir)(nil)

// Attr implements the fs.Node interface for Dir.
func (d *Dir) Attr(ctx context.Context, a *fuse.Attr) error {
	ctx = d.folder.fs.context(ctx)

	d.folder.mu.RLock()
	defer d.folder.mu.RUnlock()

	switch {
	case d.folder.id == libkbfs.NullTlfID:
		// It's a made-up folder, e.g. to show u/public when caller
		// has no access to u; no DirEntry.

	case d.parent == nil:
		// Top-level folder
		_, rootDe, err :=
			d.folder.fs.config.KBFSOps().GetOrCreateRootNodeForHandle(
				ctx, d.folder.dh, libkbfs.MasterBranch)
		if err != nil {
			return err
		}
		fillAttr(&rootDe, a)

	default:
		// Not a top-level folder => Stat is safe.
		de, err := d.folder.fs.config.KBFSOps().Stat(ctx, d.node)
		if err != nil {
			if _, ok := err.(libkbfs.NoSuchNameError); ok {
				return fuse.ESTALE
			}
			return err
		}
		fillAttr(&de, a)
	}

	a.Mode = os.ModeDir | 0700
	if d.folder.id.IsPublic() || d.folder.dh.IsPublic() {
		a.Mode |= 0055
	}
	return nil
}

var _ fs.NodeRequestLookuper = (*Dir)(nil)

// Lookup implements the fs.NodeRequestLookuper interface for Dir.
func (d *Dir) Lookup(ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (fs.Node, error) {
	ctx = d.folder.fs.context(ctx)

	d.folder.mu.RLock()
	defer d.folder.mu.RUnlock()

	if req.Name == libkbfs.PublicName &&
		d.parent == nil &&
		d.folder.dh.HasPublic() {
		dhPub := &libkbfs.TlfHandle{
			Writers: d.folder.dh.Writers,
			Readers: []keybase1.UID{keybase1.PublicUID},
		}
		rootNode, _, err :=
			d.folder.fs.config.KBFSOps().
				GetOrCreateRootNodeForHandle(ctx, dhPub, libkbfs.MasterBranch)
		if err != nil {
			return nil, err
		}
		id := rootNode.GetFolderBranch().Tlf
		pubFolder := &Folder{
			fs: d.folder.fs,
			id: id,
			dh: dhPub,
		}
		child := newDir(pubFolder, rootNode, nil)
		return child, nil
	}

	newNode, de, err := d.folder.fs.config.KBFSOps().Lookup(ctx, d.node, req.Name)
	if err != nil {
		if _, ok := err.(libkbfs.NoSuchNameError); ok {
			return nil, fuse.ENOENT
		}
		return nil, err
	}

	switch de.Type {
	default:
		return nil, fmt.Errorf("unhandled entry type: %v", de.Type)

	case libkbfs.File, libkbfs.Exec:
		child := &File{
			parent: d,
			node:   newNode,
		}
		return child, nil

	case libkbfs.Dir:
		child := newDir(d.folder, newNode, d)
		return child, nil

	case libkbfs.Sym:
		child := &Symlink{
			parent: d,
			name:   req.Name,
		}
		return child, nil
	}
}

var _ fs.NodeCreater = (*Dir)(nil)

// Create implements the fs.NodeCreater interface for Dir.
func (d *Dir) Create(ctx context.Context, req *fuse.CreateRequest, resp *fuse.CreateResponse) (fs.Node, fs.Handle, error) {
	ctx = d.folder.fs.context(ctx)

	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	isExec := (req.Mode.Perm() & 0100) != 0
	newNode, _, err := d.folder.fs.config.KBFSOps().CreateFile(
		ctx, d.node, req.Name, isExec)
	if err != nil {
		return nil, nil, err
	}

	child := &File{
		parent: d,
		node:   newNode,
	}
	return child, child, nil
}

var _ fs.NodeMkdirer = (*Dir)(nil)

// Mkdir implements the fs.NodeMkdirer interface for Dir.
func (d *Dir) Mkdir(ctx context.Context, req *fuse.MkdirRequest) (fs.Node, error) {
	ctx = d.folder.fs.context(ctx)

	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	newNode, _, err := d.folder.fs.config.KBFSOps().CreateDir(
		ctx, d.node, req.Name)
	if err != nil {
		return nil, err
	}

	child := newDir(d.folder, newNode, d)
	return child, nil
}

var _ fs.NodeSymlinker = (*Dir)(nil)

// Symlink implements the fs.NodeSymlinker interface for Dir.
func (d *Dir) Symlink(ctx context.Context, req *fuse.SymlinkRequest) (fs.Node, error) {
	ctx = d.folder.fs.context(ctx)

	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	_, err := d.folder.fs.config.KBFSOps().CreateLink(
		ctx, d.node, req.NewName, req.Target)
	if err != nil {
		return nil, err
	}

	child := &Symlink{
		parent: d,
		name:   req.NewName,
	}
	return child, nil
}

var _ fs.NodeRenamer = (*Dir)(nil)

// Rename implements the fs.NodeRenamer interface for Dir.
func (d *Dir) Rename(ctx context.Context, req *fuse.RenameRequest, newDir fs.Node) error {
	ctx = d.folder.fs.context(ctx)

	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	newDir2, ok := newDir.(*Dir)
	if !ok {
		// The destination is not a Dir instance, probably because
		// it's Root (or some other node type added later). The kernel
		// won't let a rename newDir point to a non-directory.
		//
		// We have no cheap atomic rename across folders, so we can't
		// serve this. EXDEV makes `mv` do a copy+delete, and the
		// Lookup on the destination path will decide whether it's
		// legal.
		return fuse.Errno(syscall.EXDEV)
	}
	if d.folder != newDir2.folder {
		// Check this explicitly, not just trusting KBFSOps.Rename to
		// return an error, because we rely on it for locking
		// correctness.
		return fuse.Errno(syscall.EXDEV)
	}

	err := d.folder.fs.config.KBFSOps().Rename(
		ctx, d.node, req.OldName, newDir2.node, req.NewName)
	if err != nil {
		return err
	}

	return nil
}

var _ fs.NodeRemover = (*Dir)(nil)

// Remove implements the fs.NodeRemover interface for Dir.
func (d *Dir) Remove(ctx context.Context, req *fuse.RemoveRequest) error {
	ctx = d.folder.fs.context(ctx)

	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	var err error
	if req.Dir {
		err = d.folder.fs.config.KBFSOps().RemoveDir(ctx, d.node, req.Name)
	} else {
		err = d.folder.fs.config.KBFSOps().RemoveEntry(ctx, d.node, req.Name)
	}
	if err != nil {
		return err
	}

	return nil
}

var _ fs.Handle = (*Dir)(nil)

var _ fs.HandleReadDirAller = (*Dir)(nil)

// ReadDirAll implements the fs.NodeReadDirAller interface for Dir.
func (d *Dir) ReadDirAll(ctx context.Context) ([]fuse.Dirent, error) {
	ctx = d.folder.fs.context(ctx)

	d.folder.mu.RLock()
	defer d.folder.mu.RUnlock()

	var res []fuse.Dirent
	hasPublic := d.parent == nil && d.folder.dh.HasPublic()
	if hasPublic {
		res = append(res, fuse.Dirent{
			Name: libkbfs.PublicName,
			Type: fuse.DT_Dir,
		})
	}

	if d.folder.id == libkbfs.NullTlfID {
		// It's a dummy folder for the purposes of exposing public.
		return res, nil
	}

	children, err := d.folder.fs.config.KBFSOps().GetDirChildren(ctx, d.node)
	if err != nil {
		return nil, err
	}

	for name, et := range children {
		fde := fuse.Dirent{
			Name: name,
		}
		switch et {
		case libkbfs.File, libkbfs.Exec:
			fde.Type = fuse.DT_File
		case libkbfs.Dir:
			fde.Type = fuse.DT_Dir
		case libkbfs.Sym:
			fde.Type = fuse.DT_Link
		}
		res = append(res, fde)
	}
	return res, nil
}
