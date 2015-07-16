package main

import (
	"fmt"
	"log"
	"math"
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

	// Protects fields for all Dir and File instances.
	mu sync.Mutex
	// Map KBFS nodes to FUSE nodes, to be able to handle multiple
	// lookups and incoming change notifications. A node is present
	// here if the kernel holds a reference to it.
	//
	// If we ever support hardlinks, this would need refcounts.
	//
	// Children must call folder.forgetChildLocked on receiving the
	// FUSE Forget request.
	nodes map[libkbfs.NodeID]fs.Node
}

// forgetNodeLocked forgets a formerly active child with basename
// name.
//
// Caller must hold Folder.mu.
func (f *Folder) forgetNodeLocked(node libkbfs.Node) {
	delete(f.nodes, node.GetID())
}

var _ libkbfs.Observer = (*Folder)(nil)

// invalidateNodeDataRange notifies the kernel to invalidate cached data for node.
//
// The arguments follow KBFS semantics:
//
//     - Len > 0: "bytes Off..Off+Len were mutated"
//     - Len == 0: "new file Len is Off"
//
// For comparison, the FUSE semantics are:
//
//     - Len < 0: "forget data in range Off..infinity"
//     - Len > 0: "forget data in range Off..Off+Len"
func (f *Folder) invalidateNodeDataRange(node fs.Node, write libkbfs.WriteRange) error {
	off := int64(write.Off)
	size := int64(write.Len)
	if write.Off > math.MaxInt64 || write.Len > math.MaxInt64 {
		// out of bounds, just invalidate all data
		off = 0
		size = -1
	}
	if write.Len == 0 {
		// truncate, invalidate all data in the now-lost tail
		size = -1
	}
	// Off=0 Len=0 is the same as calling InvalidateNodeDataAttr; we
	// can just let that go through InvalidateNodeDataRange.
	if err := f.fs.fuse.InvalidateNodeDataRange(node, off, size); err != nil {
		return err
	}
	return nil
}

// LocalChange is called for changes originating within in this process.
func (f *Folder) LocalChange(ctx context.Context, node libkbfs.Node, write libkbfs.WriteRange) {
	if origin, ok := ctx.Value(ctxAppIDKey).(*FS); ok && origin == f.fs {
		return
	}

	f.mu.Lock()
	n, ok := f.nodes[node.GetID()]
	f.mu.Unlock()
	if !ok {
		return
	}

	if err := f.invalidateNodeDataRange(n, write); err != nil && err != fuse.ErrNotCached {
		// TODO we have no mechanism to do anything about this
		log.Printf("FUSE invalidate error: %v", err)
	}
}

// BatchChanges is called for changes originating anywhere, including
// other hosts.
func (f *Folder) BatchChanges(ctx context.Context, changes []libkbfs.NodeChange) {
	if origin, ok := ctx.Value(ctxAppIDKey).(*FS); ok && origin == f.fs {
		return
	}

	for _, v := range changes {
		f.mu.Lock()
		n, ok := f.nodes[v.Node.GetID()]
		f.mu.Unlock()
		if !ok {
			continue
		}

		switch {
		case len(v.DirUpdated) > 0:
			// invalidate potentially cached Readdir contents
			if err := f.fs.fuse.InvalidateNodeData(n); err != nil && err != fuse.ErrNotCached {
				// TODO we have no mechanism to do anything about this
				log.Printf("FUSE invalidate error: %v", err)
			}
			for _, name := range v.DirUpdated {
				// invalidate the dentry cache
				if err := f.fs.fuse.InvalidateEntry(n, name); err != nil && err != fuse.ErrNotCached {
					// TODO we have no mechanism to do anything about this
					log.Printf("FUSE invalidate error: %v", err)
				}
			}

		case len(v.FileUpdated) > 0:
			for _, write := range v.FileUpdated {
				if err := f.invalidateNodeDataRange(n, write); err != nil && err != fuse.ErrNotCached {
					// TODO we have no mechanism to do anything about this
					log.Printf("FUSE invalidate error: %v", err)
				}
			}

		default:
			// just the attributes
			if err := f.fs.fuse.InvalidateNodeAttr(n); err != nil && err != fuse.ErrNotCached {
				// TODO we have no mechanism to do anything about this
				log.Printf("FUSE invalidate error: %v", err)
			}
		}
	}
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
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	switch {
	case d.folder.id == libkbfs.NullTlfID:
		// It's a made-up folder, e.g. to show u/public when caller
		// has no access to u; no DirEntry.

	default:
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
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	// TODO later refactoring to use /public/jdoe and
	// /private/jdoe paths will change all of this
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
		if n, ok := d.folder.nodes[rootNode.GetID()]; ok {
			return n, nil
		}

		folderBranch := rootNode.GetFolderBranch()
		pubFolder := &Folder{
			fs:    d.folder.fs,
			id:    folderBranch.Tlf,
			dh:    dhPub,
			nodes: map[libkbfs.NodeID]fs.Node{},
		}
		child := newDir(pubFolder, rootNode, nil)
		d.folder.nodes[rootNode.GetID()] = child

		// TODO we never unregister
		if err := d.folder.fs.config.Notifier().RegisterForChanges([]libkbfs.FolderBranch{folderBranch}, pubFolder); err != nil {
			return nil, err
		}

		return child, nil
	}

	newNode, de, err := d.folder.fs.config.KBFSOps().Lookup(ctx, d.node, req.Name)
	if err != nil {
		if _, ok := err.(libkbfs.NoSuchNameError); ok {
			return nil, fuse.ENOENT
		}
		return nil, err
	}

	// newNode can be nil even without errors when the KBFS direntry
	// is of a type that doesn't get its own node (is fully contained
	// in the directory); Symlink does this.
	if newNode != nil {
		if n, ok := d.folder.nodes[newNode.GetID()]; ok {
			return n, nil
		}
	}

	switch de.Type {
	default:
		return nil, fmt.Errorf("unhandled entry type: %v", de.Type)

	case libkbfs.File, libkbfs.Exec:
		child := &File{
			folder: d.folder,
			node:   newNode,
		}
		d.folder.nodes[newNode.GetID()] = child
		return child, nil

	case libkbfs.Dir:
		child := newDir(d.folder, newNode, d)
		d.folder.nodes[newNode.GetID()] = child
		return child, nil

	case libkbfs.Sym:
		child := &Symlink{
			parent: d,
			name:   req.Name,
		}
		// a Symlink is never included in Folder.nodes, as it doesn't
		// have a libkbfs.Node to keep track of renames.
		return child, nil
	}
}

var _ fs.NodeCreater = (*Dir)(nil)

// Create implements the fs.NodeCreater interface for Dir.
func (d *Dir) Create(ctx context.Context, req *fuse.CreateRequest, resp *fuse.CreateResponse) (fs.Node, fs.Handle, error) {
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	isExec := (req.Mode.Perm() & 0100) != 0
	newNode, _, err := d.folder.fs.config.KBFSOps().CreateFile(
		ctx, d.node, req.Name, isExec)
	if err != nil {
		return nil, nil, err
	}

	child := &File{
		folder: d.folder,
		node:   newNode,
	}
	d.folder.nodes[newNode.GetID()] = child
	return child, child, nil
}

var _ fs.NodeMkdirer = (*Dir)(nil)

// Mkdir implements the fs.NodeMkdirer interface for Dir.
func (d *Dir) Mkdir(ctx context.Context, req *fuse.MkdirRequest) (fs.Node, error) {
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	newNode, _, err := d.folder.fs.config.KBFSOps().CreateDir(
		ctx, d.node, req.Name)
	if err != nil {
		return nil, err
	}

	child := newDir(d.folder, newNode, d)
	d.folder.nodes[newNode.GetID()] = child
	return child, nil
}

var _ fs.NodeSymlinker = (*Dir)(nil)

// Symlink implements the fs.NodeSymlinker interface for Dir.
func (d *Dir) Symlink(ctx context.Context, req *fuse.SymlinkRequest) (fs.Node, error) {
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

	// overwritten node, if any, will be removed from Folder.nodes, if
	// it is there in the first place, by its Forget

	if err := d.folder.fs.config.KBFSOps().Rename(
		ctx, d.node, req.OldName, newDir2.node, req.NewName); err != nil {
		return err
	}

	return nil
}

var _ fs.NodeRemover = (*Dir)(nil)

// Remove implements the fs.NodeRemover interface for Dir.
func (d *Dir) Remove(ctx context.Context, req *fuse.RemoveRequest) error {
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	// node will be removed from Folder.nodes, if it is there in the
	// first place, by its Forget

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
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

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

var _ fs.NodeForgetter = (*Dir)(nil)

// Forget kernel reference to this node.
func (d *Dir) Forget() {
	if d.node == nil {
		// Dir.node can be nil for made-up entries to expose a
		// "public" subfolder
		//
		// TODO unregister, clean up Root.folders
		return
	}

	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	d.folder.forgetNodeLocked(d.node)
}
