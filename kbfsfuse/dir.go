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
	// Map KBFS nodes to FUSE nodes, to be able to handle incoming
	// change notifications.
	//
	// If we ever support hardlinks, this would need refcounts.
	nodes map[libkbfs.NodeID]folderNode
}

// folderNode is an interface that needs to be implemented by all
// fs.Node values we wish to receive change notifications for.
type folderNode interface {
	fs.Node
	KBFSNodeID() libkbfs.NodeID
}

var _ libkbfs.Observer = (*Folder)(nil)

// LocalChange is called for changes originating within in this process.
func (f *Folder) LocalChange(ctx context.Context, node libkbfs.Node, write libkbfs.WriteRange) {
	if origin, ok := ctx.Value(ctxAppIDKey).(*FS); ok && origin == f.fs {
		return
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	n, ok := f.nodes[node.GetID()]
	if !ok {
		return
	}

	// Off=0 Len=0 is the same as calling InvalidateNodeDataAttr; we
	// can just let that go through InvalidateNodeDataRange.
	off := int64(write.Off)
	size := int64(write.Len)
	if write.Off > math.MaxInt64 || write.Len > math.MaxInt64 {
		// out of bounds, just forget all data
		off = 0
		size = -1
	}
	if err := f.fs.fuse.InvalidateNodeDataRange(n, off, size); err != nil && err != fuse.ErrNotCached {
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

	f.mu.Lock()
	defer f.mu.Unlock()

	for _, v := range changes {
		n, ok := f.nodes[v.Node.GetID()]
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
				off := int64(write.Off)
				size := int64(write.Len)
				if write.Off > math.MaxInt64 || write.Len > math.MaxInt64 {
					// out of bounds, just invalidate all data
					off = 0
					size = -1
				}
				if err := f.fs.fuse.InvalidateNodeDataRange(n, off, size); err != nil && err != fuse.ErrNotCached {
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

	// Active child nodes of this directory. A node is present here if
	// the kernel holds a reference to it.
	//
	// Children are responsible for tracking their basename and
	// whether they are unlinked, with libkbfs.Node.
	//
	// Children must call parent.forgetChildLocked on receiving the
	// FUSE Forget request, if they are not unlinked.
	//
	// Entries in this map are also expected to be found in
	// Folder.nodes.
	active map[string]folderNode
}

func newDir(folder *Folder, node libkbfs.Node, parent *Dir) *Dir {
	d := &Dir{
		folder: folder,
		parent: parent,
		node:   node,
		active: map[string]folderNode{},
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
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	if child, ok := d.active[req.Name]; ok {
		return child, nil
	}

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
		folderBranch := rootNode.GetFolderBranch()
		pubFolder := &Folder{
			fs:    d.folder.fs,
			id:    folderBranch.Tlf,
			dh:    dhPub,
			nodes: map[libkbfs.NodeID]folderNode{},
		}
		child := newDir(pubFolder, rootNode, nil)
		// we store this in active for later lookups, but note that it
		// really doesn't play along the normal rules; as
		// child.parent==nil, Forget will never make it unregister
		// from active
		//
		// TODO later refactoring to use /public/jdoe and
		// /private/jdoe paths will change all of this
		d.active[req.Name] = child

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

	switch de.Type {
	default:
		return nil, fmt.Errorf("unhandled entry type: %v", de.Type)

	case libkbfs.File, libkbfs.Exec:
		child := &File{
			parent: d,
			node:   newNode,
		}
		d.active[req.Name] = child
		d.folder.nodes[newNode.GetID()] = child
		return child, nil

	case libkbfs.Dir:
		child := newDir(d.folder, newNode, d)
		d.active[req.Name] = child
		d.folder.nodes[newNode.GetID()] = child
		return child, nil

	case libkbfs.Sym:
		child := &Symlink{
			parent: d,
			name:   req.Name,
		}
		// a Symlink is never included in Dir.active, as it doesn't
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
		parent: d,
		node:   newNode,
	}
	d.active[req.Name] = child
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
	d.active[req.Name] = child
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

	err := d.folder.fs.config.KBFSOps().Rename(
		ctx, d.node, req.OldName, newDir2.node, req.NewName)
	if err != nil {
		return err
	}

	// winner is being moved on top of loser
	if winner, ok := d.active[req.OldName]; ok {
		// if the old node is active, move it to the new name
		delete(d.active, req.OldName)
		if loser, ok := newDir2.active[req.NewName]; ok {
			// node being overwritten is active (and thus in
			// Folder.nodes), it's active entry will be overwritten
			// next; remove it from Folder.nodes.
			delete(d.folder.nodes, loser.KBFSNodeID())
		}
		newDir2.active[req.NewName] = winner
	} else {
		// just make sure there's no previous active entry for new
		// name
		if loser, ok := newDir2.active[req.NewName]; ok {
			// node being overwritten is active (and thus in
			// Folder.nodes), remove from both.
			delete(d.folder.nodes, loser.KBFSNodeID())
			delete(newDir2.active, req.NewName)
		}
	}

	return nil
}

var _ fs.NodeRemover = (*Dir)(nil)

// Remove implements the fs.NodeRemover interface for Dir.
func (d *Dir) Remove(ctx context.Context, req *fuse.RemoveRequest) error {
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

	if n, ok := d.active[req.Name]; ok {
		delete(d.folder.nodes, n.KBFSNodeID())
		delete(d.active, req.Name)
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
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	if d.parent == nil {
		// Top-level directory of a folder, or the "public" folder.
		return
	}
	name := d.node.GetBasename()
	if name == "" {
		// unlinked
		return
	}
	d.parent.forgetChildLocked(d, name)
}

// forgetChildLocked forgets a formerly active child with basename
// name.
//
// Caller must hold Folder.mu.
func (d *Dir) forgetChildLocked(child fs.Node, name string) {
	if n, ok := d.active[name]; ok {
		delete(d.folder.nodes, n.KBFSNodeID())
		delete(d.active, name)
	}
}

var _ folderNode = (*Dir)(nil)

// KBFSNodeID returns the libkbfs.NodeID for this node, for use in
// libkbfs change notification callbacks.
func (d *Dir) KBFSNodeID() libkbfs.NodeID {
	return d.node.GetID()
}
