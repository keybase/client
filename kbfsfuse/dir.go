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

type Folder struct {
	fs *FS
	id libkbfs.DirId
	dh *libkbfs.DirHandle

	// Protects all Dir.pathNode and File.pathNode instances.
	mu sync.RWMutex
}

type Dir struct {
	fs.NodeRef

	folder   *Folder
	parent   *Dir
	pathNode libkbfs.PathNode
}

var _ fs.Node = (*Dir)(nil)

func (d *Dir) Attr(a *fuse.Attr) {
	a.Mode = os.ModeDir | 0700
	if d.folder.id.IsPublic() || d.folder.dh.IsPublic() {
		a.Mode |= 0055
	}
}

// getPath returns the Path for the current directory.
//
// Caller is responsible for locking.
func (d *Dir) getPathLocked() libkbfs.Path {
	p := libkbfs.Path{
		TopDir: d.folder.id,
	}
	for cur := d; cur != nil; cur = cur.parent {
		p.Path = append(p.Path, cur.pathNode)
	}
	// reverse
	for i := len(p.Path)/2 - 1; i >= 0; i-- {
		opp := len(p.Path) - 1 - i
		p.Path[i], p.Path[opp] = p.Path[opp], p.Path[i]
	}
	return p
}

// Update the PathNode stored here, and in parents.
//
// Caller is responsible for locking.
func (d *Dir) updatePathLocked(p libkbfs.Path) {
	for dir, path := d, p.Path; dir != nil; dir, path = dir.parent, path[:len(path)-1] {
		pNode := path[len(path)-1]
		if dir.pathNode.Name != pNode.Name {
			break
		}
		dir.pathNode = pNode
	}
}

var _ fs.NodeRequestLookuper = (*Dir)(nil)

func (d *Dir) Lookup(ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (fs.Node, error) {
	d.folder.mu.RLock()
	defer d.folder.mu.RUnlock()

	p := d.getPathLocked()

	if req.Name == libkbfs.PublicName &&
		p.HasPublic() &&
		d.folder.dh.HasPublic() {
		dhPub := &libkbfs.DirHandle{
			Writers: d.folder.dh.Writers,
			Readers: []keybase1.UID{keybase1.PublicUID},
		}
		md, err := d.folder.fs.config.KBFSOps().GetRootMDForHandle(dhPub)
		if err != nil {
			return nil, err
		}
		pubFolder := &Folder{
			fs: d.folder.fs,
			id: md.Id,
			dh: dhPub,
		}
		child := &Dir{
			folder: pubFolder,
			pathNode: libkbfs.PathNode{
				BlockPointer: md.Data().Dir.BlockPointer,
				Name:         req.Name,
			},
		}
		return child, nil
	}

	dirBlock, err := d.folder.fs.config.KBFSOps().GetDir(p)
	if err != nil {
		return nil, err
	}
	de, ok := dirBlock.Children[req.Name]
	if !ok {
		return nil, fuse.ENOENT
	}

	switch de.Type {
	default:
		return nil, fmt.Errorf("unhandled entry type: %v", de.Type)

	case libkbfs.File, libkbfs.Exec:
		child := &File{
			parent: d,
			de:     de,
			pathNode: libkbfs.PathNode{
				BlockPointer: de.BlockPointer,
				Name:         req.Name,
			},
		}
		return child, nil

	case libkbfs.Dir:
		child := &Dir{
			folder: d.folder,
			parent: d,
			pathNode: libkbfs.PathNode{
				BlockPointer: de.BlockPointer,
				Name:         req.Name,
			},
		}
		return child, nil

	case libkbfs.Sym:
		child := &Symlink{
			parent: d,
			de:     de,
			pathNode: libkbfs.PathNode{
				// use a null block pointer for symlinks
				Name: req.Name,
			},
		}
		return child, nil
	}
}

var _ fs.NodeCreater = (*Dir)(nil)

func (d *Dir) Create(ctx context.Context, req *fuse.CreateRequest, resp *fuse.CreateResponse) (fs.Node, fs.Handle, error) {
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	isExec := (req.Mode.Perm() & 0100) != 0
	pChild, de, err := d.folder.fs.config.KBFSOps().CreateFile(d.getPathLocked(), req.Name, isExec)
	if err != nil {
		return nil, nil, err
	}
	d.updatePathLocked(*pChild.ParentPath())
	// TODO update mtime, ctime, size?

	child := &File{
		parent: d,
		de:     de,
		pathNode: libkbfs.PathNode{
			BlockPointer: de.BlockPointer,
			Name:         req.Name,
		},
	}
	return child, child, nil
}

var _ fs.NodeMkdirer = (*Dir)(nil)

func (d *Dir) Mkdir(ctx context.Context, req *fuse.MkdirRequest) (fs.Node, error) {
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	pChild, de, err := d.folder.fs.config.KBFSOps().CreateDir(d.getPathLocked(), req.Name)
	if err != nil {
		return nil, err
	}
	d.updatePathLocked(*pChild.ParentPath())
	// TODO update mtime, ctime, size?

	child := &Dir{
		folder: d.folder,
		parent: d,
		pathNode: libkbfs.PathNode{
			BlockPointer: de.BlockPointer,
			Name:         req.Name,
		},
	}
	return child, nil
}

var _ fs.NodeSymlinker = (*Dir)(nil)

func (d *Dir) Symlink(ctx context.Context, req *fuse.SymlinkRequest) (fs.Node, error) {
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	p, de, err := d.folder.fs.config.KBFSOps().CreateLink(d.getPathLocked(), req.NewName, req.Target)
	if err != nil {
		return nil, err
	}
	d.updatePathLocked(p)
	// TODO update mtime, ctime, size?

	child := &Symlink{
		parent: d,
		de:     de,
		pathNode: libkbfs.PathNode{
			// use a null block pointer for symlinks
			Name: req.NewName,
		},
	}
	return child, nil
}

var _ fs.NodeRenamer = (*Dir)(nil)

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
		// Lookup on the destination path will decide whether the it's
		// legal.
		return fuse.Errno(syscall.EXDEV)
	}
	if d.folder != newDir2.folder {
		// Check this explicitly, not just trusting KBFSOps.Rename to
		// return an error, because we rely on it for locking
		// correctness.
		return fuse.Errno(syscall.EXDEV)
	}

	oldParent := d.getPathLocked()
	newParent := newDir2.getPathLocked()

	pOld, pNew, err := d.folder.fs.config.KBFSOps().Rename(oldParent, req.OldName, newParent, req.NewName)
	if err != nil {
		return err
	}
	// TODO why can't i trigger a test failure if these are missing
	d.updatePathLocked(pOld)
	newDir2.updatePathLocked(pNew)
	// TODO update mtime, ctime, size?

	return nil
}

var _ fs.NodeRemover = (*Dir)(nil)

func (d *Dir) Remove(ctx context.Context, req *fuse.RemoveRequest) error {
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	p := d.getPathLocked()
	dirBlock, err := d.folder.fs.config.KBFSOps().GetDir(p)
	if err != nil {
		return err
	}

	de, ok := dirBlock.Children[req.Name]
	if !ok {
		return fuse.ENOENT
	}

	p.Path = append(p.Path, libkbfs.PathNode{
		BlockPointer: de.BlockPointer,
		Name:         req.Name,
	})

	switch {
	case !req.Dir && de.Type == libkbfs.Dir:
		return fuse.Errno(syscall.EISDIR)
	case req.Dir && de.Type != libkbfs.Dir:
		return fuse.Errno(syscall.ENOTDIR)
	}

	var p2 libkbfs.Path
	if req.Dir {
		p2, err = d.folder.fs.config.KBFSOps().RemoveDir(p)
	} else {
		p2, err = d.folder.fs.config.KBFSOps().RemoveEntry(p)
	}
	if err != nil {
		return err
	}

	d.updatePathLocked(p2)
	return nil
}

var _ fs.Handle = (*Dir)(nil)

var _ fs.HandleReadDirAller = (*Dir)(nil)

func (d *Dir) ReadDirAll(ctx context.Context) ([]fuse.Dirent, error) {
	p := d.getPathLocked()
	dirBlock, err := d.folder.fs.config.KBFSOps().GetDir(p)
	if err != nil {
		return nil, err
	}

	var res []fuse.Dirent
	if p.HasPublic() && d.folder.dh.HasPublic() {
		res = append(res, fuse.Dirent{
			Name: libkbfs.PublicName,
			Type: fuse.DT_Dir,
		})
	}
	for name, de := range dirBlock.Children {
		fde := fuse.Dirent{
			Name: name,
		}
		switch de.Type {
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
