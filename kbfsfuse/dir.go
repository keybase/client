package main

import (
	"fmt"
	"os"
	"sync"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/libkb"
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
func (d *Dir) getPath() libkbfs.Path {
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
func (d *Dir) updatePath(p libkbfs.Path) {
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

	p := d.getPath()

	if req.Name == libkbfs.PublicName &&
		p.HasPublic() &&
		d.folder.dh.HasPublic() {
		dhPub := &libkbfs.DirHandle{
			Writers: d.folder.dh.Writers,
			Readers: []libkb.UID{libkbfs.PublicUid},
		}
		md, err := d.folder.fs.config.KBFSOps().GetRootMDForHandle(dhPub)
		if err != nil {
			return nil, err
		}
		pubFolder := &Folder{
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
			exec: de.Type == libkbfs.Exec,
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
	p, de, err := d.folder.fs.config.KBFSOps().CreateFile(d.getPath(), req.Name, isExec)
	if err != nil {
		return nil, nil, err
	}
	d.updatePath(p)
	// TODO update mtime, ctime, size?

	child := &File{
		parent: d,
		de:     de,
		pathNode: libkbfs.PathNode{
			BlockPointer: de.BlockPointer,
			Name:         req.Name,
		},
		exec: isExec,
	}
	return child, child, nil
}

var _ fs.NodeMkdirer = (*Dir)(nil)

func (d *Dir) Mkdir(ctx context.Context, req *fuse.MkdirRequest) (fs.Node, error) {
	d.folder.mu.Lock()
	defer d.folder.mu.Unlock()

	p, de, err := d.folder.fs.config.KBFSOps().CreateDir(d.getPath(), req.Name)
	if err != nil {
		return nil, err
	}
	d.updatePath(p)
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

	p, de, err := d.folder.fs.config.KBFSOps().CreateLink(d.getPath(), req.NewName, req.Target)
	if err != nil {
		return nil, err
	}
	d.updatePath(p)
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

var _ fs.Handle = (*Dir)(nil)

var _ fs.HandleReadDirAller = (*Dir)(nil)

func (d *Dir) ReadDirAll(ctx context.Context) ([]fuse.Dirent, error) {
	dirBlock, err := d.folder.fs.config.KBFSOps().GetDir(d.getPath())
	if err != nil {
		return nil, err
	}

	var res []fuse.Dirent
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
