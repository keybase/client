package main

import (
	"sync"
	"syscall"
	"time"

	"github.com/hanwen/go-fuse/fuse"
	"github.com/hanwen/go-fuse/fuse/nodefs"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/util"
	"golang.org/x/net/context"
)

type statusChan chan fuse.Status

// ErrorNode is a FuseNode for the ErrorFile
type ErrorNode struct {
	nodefs.Node

	Ops *FuseOps
}

// FuseOps implements the low-level FUSE interface for go-fuse, in a
// goroutine-safe way.
type FuseOps struct {
	config       libkbfs.Config
	topNodes     map[string]*FuseNode
	topNodesByID map[libkbfs.DirID]*FuseNode
	topLock      sync.RWMutex
	dirRWChans   *libkbfs.DirRWSchedulers
}

// NewFuseRoot constructs a new root FUSE node for KBFS.
func NewFuseRoot(config libkbfs.Config) *FuseNode {
	f := &FuseOps{
		config:       config,
		topNodes:     make(map[string]*FuseNode),
		topNodesByID: make(map[libkbfs.DirID]*FuseNode),
		dirRWChans:   libkbfs.NewDirRWSchedulers(config),
	}
	return &FuseNode{
		Node: nodefs.NewDefaultNode(),
		Ops:  f,
	}
}

// FuseFile is a KBFS file in FUSE.
type FuseFile struct {
	nodefs.File

	Node *FuseNode
}

// FuseNode is any KBFS top-level folder, subdirectory, or file in
// FUSE.
type FuseNode struct {
	nodefs.Node

	PathNode   libkbfs.PathNode
	PrevNode   *FuseNode
	Entry      libkbfs.DirEntry
	NeedUpdate bool               // Whether Entry needs to be updated.
	Dir        libkbfs.DirID      // only set if this is a root node
	DirHandle  *libkbfs.DirHandle // only set if this is a root node
	File       *FuseFile
	Ops        *FuseOps
}

// GetAttr implements the go-fuse Node interface for the ErrorFile
func (n *ErrorNode) GetAttr(
	out *fuse.Attr, file nodefs.File, context *fuse.Context) fuse.Status {
	data, etime := n.Ops.config.Reporter().LastError()
	out.Size = uint64(len(data)) + 1 // we'll add in a newline
	out.Mode = fuse.S_IFREG | 0444
	out.SetTimes(nil, etime, etime)
	return fuse.OK
}

// Open implements the go-fuse Node interface for the ErrorFile
func (n *ErrorNode) Open(flags uint32, context *fuse.Context) (
	file nodefs.File, code fuse.Status) {
	return nil, fuse.OK
}

// Read implements the go-fuse Node interface for the ErrorFile
func (n *ErrorNode) Read(
	file nodefs.File, dest []byte, off int64, context *fuse.Context) (
	fuse.ReadResult, fuse.Status) {
	data, _ := n.Ops.config.Reporter().LastError()
	data += "\n"

	size := int64(len(dest))
	currLen := int64(len(data))
	if currLen < (off + size) {
		size = currLen - off
	}

	copy(dest, data[off:off+size])

	return fuse.ReadResultData(dest[:size]), fuse.OK
}

func (n *FuseNode) getChan() util.RWScheduler {
	if n.PrevNode == nil {
		return n.Ops.dirRWChans.GetDirChan(n.Dir)
	}
	return n.PrevNode.getChan()
}

func (n *FuseNode) getPath(depth int) libkbfs.Path {
	var p libkbfs.Path
	if n.PrevNode == nil {
		p = libkbfs.Path{
			TopDir: n.Dir,
			Path:   make([]libkbfs.PathNode, 0, depth),
		}
	} else {
		p = n.PrevNode.getPath(depth + 1)
	}
	p.Path = append(p.Path, n.PathNode)
	return p
}

// Shutdown cleanly stops any goroutines started by this FuseOps.
func (f *FuseOps) Shutdown() {
	f.dirRWChans.Shutdown()
}

// LookupInDir finds a directory entry in a given subdirectory.
func (f *FuseOps) LookupInDir(dNode *FuseNode, name string) (
	node *nodefs.Inode, code fuse.Status) {
	node = dNode.Inode().GetChild(name)
	if node == nil {
		if name == libkbfs.ErrorFile {
			return dNode.Inode().NewChild(name, false, &ErrorNode{
				Node: nodefs.NewDefaultNode(),
				Ops:  f,
			}), fuse.OK
		}

		p := dNode.getPath(1)

		// is this the public top-level directory?
		if name == libkbfs.PublicName && p.HasPublic() &&
			dNode.DirHandle.HasPublic() {
			dirHandle := &libkbfs.DirHandle{
				Writers: dNode.DirHandle.Writers,
				Readers: []keybase1.UID{keybase1.PublicUID},
			}
			md, err := f.config.KBFSOps().GetRootMDForHandle(dirHandle)
			if err != nil {
				return nil, f.translateError(err)
			}
			fNode := &FuseNode{
				Node:      nodefs.NewDefaultNode(),
				Dir:       md.ID,
				DirHandle: dirHandle,
				Entry:     md.Data().Dir,
				PathNode: libkbfs.PathNode{
					BlockPointer: md.Data().Dir.BlockPointer,
					Name:         dirHandle.ToString(f.config),
				},
				Ops: f,
			}

			node = dNode.Inode().NewChild(name, true, fNode)
			f.topLock.Lock()
			defer f.topLock.Unlock()
			f.addTopNodeLocked(dirHandle.ToString(f.config), md.ID, fNode)
			return node, fuse.OK
		} else if p.TopDir == libkbfs.NullDirID {
			uid, err := f.config.KBPKI().GetLoggedInUser()
			if err != nil {
				return nil, f.translateError(err)
			}
			return nil, f.translateError(libkbfs.NewReadAccessError(
				f.config, dNode.DirHandle, uid))
		}

		dBlock, err := f.config.KBFSOps().GetDir(p)
		if err != nil {
			return nil, f.translateError(err)
		}

		de, ok := dBlock.Children[name]
		if !ok {
			return nil, f.translateError(&libkbfs.NoSuchNameError{Name: name})
		}

		var pathNode libkbfs.PathNode
		if de.Type == libkbfs.Sym {
			// use a null block pointer for symlinks
			pathNode = libkbfs.PathNode{Name: name}
		} else {
			pathNode = libkbfs.PathNode{
				BlockPointer: de.BlockPointer,
				Name:         name,
			}
		}
		fNode := &FuseNode{
			Node:     nodefs.NewDefaultNode(),
			PathNode: pathNode,
			PrevNode: dNode,
			Ops:      f,
			Entry:    de,
		}
		if de.Type != libkbfs.Dir {
			fNode.File = &FuseFile{
				File: nodefs.NewDefaultFile(),
				Node: fNode,
			}
		}
		node = dNode.Inode().NewChild(name, de.Type == libkbfs.Dir, fNode)
	}

	return node, fuse.OK
}

// TODO: In the two functions below, we set NeedUpdate to true all the
// way to the root because the BlockPointer and Size fields are
// changed for the whole path. However, GetAttr() doesn't use
// BlockPointer, and it may be possible to assume that the Size field
// doesn't change for all but the leaf node and its parent. In that
// case, we'd only need to set NeedUpdate for those two nodes.

// LocalChange sets NeedUpdate for all nodes that we know about on the path
func (f *FuseOps) LocalChange(path libkbfs.Path) {
	f.topLock.RLock()
	defer f.topLock.RUnlock()

	topNode := f.topNodesByID[path.TopDir]
	if topNode == nil {
		return
	}

	rwchan := topNode.getChan()
	rwchan.QueueWriteReq(func() {
		// Set NeedUpdate for all relevant FuseNodes
		currNode := topNode
		for i := 0; currNode != nil && i < len(path.Path); {
			currNode.NeedUpdate = true
			i++
			// lookup the next node, if possible
			var nextNode *nodefs.Inode
			if i < len(path.Path) {
				pn := path.Path[i]
				nextNode = currNode.Inode().GetChild(pn.Name)
			}
			if nextNode != nil {
				currNode = nextNode.Node().(*FuseNode)
			} else {
				currNode = nil
			}
		}
	})
}

func (f *FuseOps) updatePaths(n *FuseNode, newPath []libkbfs.PathNode) {
	// Update all the paths back to the root.
	//
	// TODO: Make sure len(newPath) == length of path from n to root.
	index := len(newPath) - 1
	currNode := n
	for index >= 0 && currNode != nil {
		currNode.NeedUpdate = true
		currNode.PathNode = newPath[index]
		index--
		currNode = currNode.PrevNode
	}
}

// BatchChanges sets NeedUpdate for all nodes that we know about on
// the path, and updates the PathNode (including the new
// BlockPointer).
func (f *FuseOps) BatchChanges(dir libkbfs.DirID, paths []libkbfs.Path) {
	if len(paths) == 0 {
		return
	}

	f.topLock.RLock()
	defer f.topLock.RUnlock()

	topNode := f.topNodesByID[dir]
	if topNode == nil {
		return
	}

	rwchan := topNode.getChan()
	rwchan.QueueWriteReq(func() {
		for _, path := range paths {
			// TODO: verify path.TopDir matches dir
			// navigate to the end of the path, then update the complete path
			currNode := topNode
			// Count the number of nodes for which we already have
			// corresponding FuseNodes.
			i := 1
			for ; i < len(path.Path); i++ {
				nextNode := currNode.Inode().GetChild(path.Path[i].Name)
				if nextNode == nil {
					break
				} else {
					currNode = nextNode.Node().(*FuseNode)
				}
			}
			f.updatePaths(currNode, path.Path[:i])
		}
	})
}

func (f *FuseOps) addTopNodeLocked(
	name string, id libkbfs.DirID, fNode *FuseNode) {
	f.topNodes[name] = fNode
	if _, ok := f.topNodesByID[id]; !ok {
		f.config.Notifier().RegisterForChanges([]libkbfs.DirID{id}, f)
		f.topNodesByID[id] = fNode
	}
}

// LookupInRootByName find a top-level folder node in the root KBFS
// mount, given a name.
func (f *FuseOps) LookupInRootByName(rNode *FuseNode, name string) (
	node *nodefs.Inode, code fuse.Status) {
	node = rNode.Inode().GetChild(name)
	if node == nil {
		if name == libkbfs.ErrorFile {
			return rNode.Inode().NewChild(name, false, &ErrorNode{
				Node: nodefs.NewDefaultNode(),
				Ops:  f,
			}), fuse.OK
		}

		// try to resolve the user name; if it works create a node
		ctx := context.TODO()
		dirHandle, err := libkbfs.ParseDirHandle(ctx, f.config, name)
		if err != nil {
			return nil, f.translateError(err)
		} else if dirHandle.IsPublic() {
			// public directories shouldn't be listed directly in root
			return nil, fuse.ENOENT
		}
		f.topLock.Lock()
		defer f.topLock.Unlock()
		dirString := dirHandle.ToString(f.config)
		if fNode, ok := f.topNodes[dirString]; ok {
			node = rNode.Inode().NewChild(name, true, fNode)
			f.addTopNodeLocked(name, fNode.Dir, fNode)
		} else {
			md, err := f.config.KBFSOps().GetRootMDForHandle(dirHandle)
			var fNode *FuseNode
			if _, ok :=
				err.(*libkbfs.ReadAccessError); ok && dirHandle.HasPublic() {
				// This user cannot get the metadata for the directory.
				// But, if it has a public directory, we should still be
				// able to list that public directory, right?  Make a fake
				// node for it.
				fNode = &FuseNode{
					Node:      nodefs.NewDefaultNode(),
					DirHandle: dirHandle,
					Dir:       libkbfs.NullDirID,
					PathNode: libkbfs.PathNode{
						BlockPointer: libkbfs.BlockPointer{},
						Name:         dirString,
					},
					Entry: libkbfs.DirEntry{Type: libkbfs.Dir},
					Ops:   f,
				}
				f.topNodes[dirString] = fNode
				f.topNodes[name] = fNode
			} else if err != nil {
				return nil, f.translateError(err)
			} else {
				fNode = &FuseNode{
					Node:      nodefs.NewDefaultNode(),
					Dir:       md.ID,
					DirHandle: dirHandle,
					Entry:     md.Data().Dir,
					PathNode: libkbfs.PathNode{
						BlockPointer: md.Data().Dir.BlockPointer,
						Name:         dirString,
					},
					Ops: f,
				}
			}

			node = rNode.Inode().NewChild(name, true, fNode)
			if md != nil {
				f.addTopNodeLocked(name, md.ID, fNode)
				f.addTopNodeLocked(dirString, md.ID, fNode)
			}
		}
	}
	return node, fuse.OK
}

// LookupInRootByID find a top-level folder node in the root KBFS
// mount, given a top-level folder ID.
func (f *FuseOps) LookupInRootByID(rNode *FuseNode, id libkbfs.DirID) (
	node *nodefs.Inode, code fuse.Status) {
	md, err := f.config.KBFSOps().GetRootMD(id)
	if err != nil {
		return nil, f.translateError(err)
	}
	dirHandle := md.GetDirHandle()
	name := dirHandle.ToString(f.config)

	node = rNode.Inode().GetChild(name)
	if node == nil {
		f.topLock.Lock()
		defer f.topLock.Unlock()

		if fNode, ok := f.topNodes[name]; ok {
			node = rNode.Inode().NewChild(name, true, fNode)
		} else {
			fNode := &FuseNode{
				Node:      nodefs.NewDefaultNode(),
				Dir:       id,
				DirHandle: dirHandle,
				Entry:     md.Data().Dir,
				PathNode: libkbfs.PathNode{
					BlockPointer: md.Data().Dir.BlockPointer,
					Name:         name,
				},
				Ops: f,
			}

			node = rNode.Inode().NewChild(name, true, fNode)
			f.addTopNodeLocked(name, id, fNode)
		}
	}
	return node, fuse.OK
}

// GetAttr returns the attributes for a given KBFS node.
func (f *FuseOps) GetAttr(n *FuseNode, out *fuse.Attr) fuse.Status {
	if n.PrevNode != nil || n.DirHandle != nil {
		p := n.getPath(1)
		if n.NeedUpdate {
			var de libkbfs.DirEntry
			if len(p.Path) > 1 {
				// need to fetch the entry anew
				dBlock, err := f.config.KBFSOps().GetDir(*p.ParentPath())
				if err != nil {
					return f.translateError(err)
				}

				name := p.TailName()
				var ok bool
				de, ok = dBlock.Children[name]
				if !ok {
					return f.translateError(
						&libkbfs.NoSuchNameError{Name: name})
				}
			} else {
				md, err := f.config.KBFSOps().GetRootMDForHandle(n.DirHandle)
				if err != nil {
					return f.translateError(err)
				}
				de = md.Data().Dir
			}

			n.Entry = de
			n.NeedUpdate = false
		}

		out.Size = n.Entry.Size
		out.Mode = fuseModeFromEntry(p.TopDir, n.Entry)
		mtime := time.Unix(0, n.Entry.Mtime)
		ctime := time.Unix(0, n.Entry.Ctime)
		out.SetTimes(nil, &mtime, &ctime)
	} else {
		out.Mode = fuse.S_IFDIR | 0750
		// TODO: do any other stats make sense in the root?
	}

	return fuse.OK
}

func fuseModeFromEntry(dir libkbfs.DirID, de libkbfs.DirEntry) uint32 {
	var pubModeFile, pubModeExec, pubModeDir, pubModeSym uint32
	if dir.IsPublic() {
		pubModeFile = 0044
		pubModeExec = 0055
		pubModeDir = 0055
		pubModeSym = 0044
	}

	switch de.Type {
	case libkbfs.File:
		return fuse.S_IFREG | 0640 | pubModeFile
	case libkbfs.Exec:
		return fuse.S_IFREG | 0750 | pubModeExec
	case libkbfs.Dir:
		return fuse.S_IFDIR | 0750 | pubModeDir
	case libkbfs.Sym:
		return fuse.S_IFLNK | 0640 | pubModeSym
	default:
		return 0
	}
}

// ListDir returns all directory entries for the given subdirectory.
func (f *FuseOps) ListDir(n *FuseNode) (
	stream []fuse.DirEntry, code fuse.Status) {
	p := n.getPath(1)

	// If this is the top-level directory, then list the public
	// directory as well (if there are no readers)
	hasPublic := p.HasPublic() && n.DirHandle.HasPublic()
	if hasPublic {
		stream = append(stream, fuse.DirEntry{
			Name: libkbfs.PublicName,
			Mode: fuse.S_IFDIR | 0755,
		})
	}

	if dBlock, err := f.config.KBFSOps().GetDir(p); err != nil {
		code = f.translateError(err)
		if !hasPublic {
			return
		}
	} else {
		for name, de := range dBlock.Children {
			stream = append(stream, fuse.DirEntry{
				Name: name,
				Mode: fuseModeFromEntry(p.TopDir, de),
			})
		}
	}

	code = fuse.OK
	return
}

// ListRoot returns all of the canonical, top-level folders for this
// user in KBFS.
func (f *FuseOps) ListRoot() (stream []fuse.DirEntry, code fuse.Status) {
	f.topLock.RLock()
	defer f.topLock.RUnlock()
	stream = make([]fuse.DirEntry, 0, len(f.topNodes))
	for tn, fNode := range f.topNodes {
		// don't list public directories
		if fNode.Dir.IsPublic() {
			continue
		}
		stream = append(stream, fuse.DirEntry{
			Name: tn,
			Mode: fuse.S_IFDIR | 0750,
		})
	}

	code = fuse.OK
	return
}

// Chmod sets or unsets the executable bit for the given KBFS node.
func (f *FuseOps) Chmod(n *FuseNode, perms uint32) (code fuse.Status) {
	ex := perms&0100 != 0
	p := n.getPath(1)
	_, err := f.config.KBFSOps().SetEx(p, ex)
	if err != nil {
		return f.translateError(err)
	}

	return fuse.OK
}

// Utimens sets the mtime for the given KBFS node.
func (f *FuseOps) Utimens(n *FuseNode, mtime *time.Time) (code fuse.Status) {
	p := n.getPath(1)
	_, err := f.config.KBFSOps().SetMtime(p, mtime)
	if err != nil {
		return f.translateError(err)
	}

	return fuse.OK
}

// Mkdir makes a new subdirectory in KBFS.
func (f *FuseOps) Mkdir(n *FuseNode, name string) (
	newNode *nodefs.Inode, code fuse.Status) {
	if name == libkbfs.ErrorFile {
		return nil, f.translateError(&libkbfs.ErrorFileAccessError{})
	}

	p := n.getPath(1)
	newPath, de, err := f.config.KBFSOps().CreateDir(p, name)
	if err != nil {
		return nil, f.translateError(err)
	}

	// create a new inode for the new directory
	fNode := &FuseNode{
		Node:     nodefs.NewDefaultNode(),
		PrevNode: n,
		Entry:    de,
		PathNode: newPath.Path[len(newPath.Path)-1],
		Ops:      f,
	}
	newNode = n.Inode().NewChild(name, true, fNode)

	code = fuse.OK
	return
}

// Mknod makes a new file in KBFS.
func (f *FuseOps) Mknod(n *FuseNode, name string, mode uint32) (
	newNode *nodefs.Inode, code fuse.Status) {
	if name == libkbfs.ErrorFile {
		return nil, f.translateError(&libkbfs.ErrorFileAccessError{})
	}

	p := n.getPath(1)
	newPath, de, err := f.config.KBFSOps().CreateFile(p, name, mode&0100 != 0)
	if err != nil {
		return nil, f.translateError(err)
	}

	// create a new inode for the new directory
	fNode := &FuseNode{
		Node:     nodefs.NewDefaultNode(),
		PrevNode: n,
		Entry:    de,
		PathNode: newPath.Path[len(newPath.Path)-1],
		File:     &FuseFile{File: nodefs.NewDefaultFile()},
		Ops:      f,
	}
	fNode.File.Node = fNode
	newNode = n.Inode().NewChild(name, true, fNode)

	code = fuse.OK
	return
}

// Read reads data from the given KBFS file.
func (f *FuseOps) Read(n *FuseNode, dest []byte, off int64) (
	fuse.ReadResult, fuse.Status) {
	p := n.getPath(1)
	bytes, err := f.config.KBFSOps().Read(p, dest, off)
	if err != nil {
		return nil, f.translateError(err)
	}
	return fuse.ReadResultData(dest[:bytes]), fuse.OK
}

// Write writes data to the given KBFS file.
func (f *FuseOps) Write(n *FuseNode, data []byte, off int64) (
	written uint32, code fuse.Status) {
	p := n.getPath(1)
	err := f.config.KBFSOps().Write(p, data, off)
	if err != nil {
		return 0, f.translateError(err)
	}
	return uint32(len(data)), fuse.OK
}

// Truncate truncates the size of the given KBFS file.
func (f *FuseOps) Truncate(n *FuseNode, size uint64) (code fuse.Status) {
	p := n.getPath(1)
	err := f.config.KBFSOps().Truncate(p, size)
	if err != nil {
		return f.translateError(err)
	}
	return fuse.OK
}

// Symlink creates a new symbolic link in KBFS.
func (f *FuseOps) Symlink(n *FuseNode, name string, content string) (
	newNode *nodefs.Inode, code fuse.Status) {
	if name == libkbfs.ErrorFile {
		return nil, f.translateError(&libkbfs.ErrorFileAccessError{})
	}

	p := n.getPath(1)
	_, de, err := f.config.KBFSOps().CreateLink(p, name, content)
	if err != nil {
		return nil, f.translateError(err)
	}

	// create a new inode for the new directory
	lNode := &FuseNode{
		Node:     nodefs.NewDefaultNode(),
		PrevNode: n,
		PathNode: libkbfs.PathNode{Name: name},
		Entry:    de,
		Ops:      f,
	}
	newNode = n.Inode().NewChild(name, false, lNode)

	code = fuse.OK
	return
}

// Readlink reads the contents of a new symbolic link in KBFS.
func (f *FuseOps) Readlink(n *FuseNode) ([]byte, fuse.Status) {
	return []byte(n.Entry.SymPath), fuse.OK
}

// RmEntry removes a subdirectory or file from KBFS.
func (f *FuseOps) RmEntry(n *FuseNode, name string, isDir bool) (
	code fuse.Status) {
	if name == libkbfs.ErrorFile {
		return f.translateError(&libkbfs.ErrorFileAccessError{})
	}

	child := n.Inode().GetChild(name)
	var p libkbfs.Path
	if child == nil {
		p = n.getPath(1)
		// make a fake pathnode for this name
		p.Path = append(p.Path, libkbfs.PathNode{Name: name})
	} else {
		p = child.Node().(*FuseNode).getPath(1)
	}

	// Can't remove public directories
	if name == libkbfs.PublicName {
		if parentPath := n.getPath(1); parentPath.HasPublic() {
			return f.translateError(&libkbfs.TopDirAccessError{Name: p})
		}
	}

	var err error
	if isDir {
		_, err = f.config.KBFSOps().RemoveDir(p)
	} else {
		_, err = f.config.KBFSOps().RemoveEntry(p)
	}
	if err != nil {
		return f.translateError(err)
	}

	// clear out the inode if it exists
	n.Inode().RmChild(name)

	return fuse.OK
}

// Rename moves one entry to another name, within the same top-level
// KBFS folder.
func (f *FuseOps) Rename(
	oldParent *FuseNode, oldName string, newParent *FuseNode, newName string) (
	code fuse.Status) {
	if oldName == libkbfs.ErrorFile || newName == libkbfs.ErrorFile {
		return f.translateError(&libkbfs.ErrorFileAccessError{})
	}

	oldPath := oldParent.getPath(1)
	newPath := newParent.getPath(1)

	if oldPath.TopDir != newPath.TopDir {
		return f.translateError(&libkbfs.RenameAcrossDirsError{})
	}

	_, _, err := f.config.KBFSOps().Rename(
		oldPath, oldName, newPath, newName)
	if err != nil {
		return f.translateError(err)
	}

	childNode := oldParent.Inode().RmChild(oldName)
	childNode.Node().(*FuseNode).PathNode.Name = newName
	childNode.Node().(*FuseNode).PrevNode = newParent
	// remove old one, if it existed
	newParent.Inode().RmChild(newName)
	newParent.Inode().AddChild(newName, childNode)

	return fuse.OK
}

// Flush syncs the given KBFS node.
func (f *FuseOps) Flush(n *FuseNode) fuse.Status {
	p := n.getPath(1)
	_, err := f.config.KBFSOps().Sync(p)
	if err != nil {
		return f.translateError(err)
	}

	return fuse.OK
}

func (f *FuseOps) translateError(err error) fuse.Status {
	f.config.Reporter().Report(libkbfs.RptE, &libkbfs.WrapError{Err: err})
	switch err.(type) {
	case *libkbfs.NameExistsError:
		return fuse.Status(syscall.EEXIST)
	case *libkbfs.NoSuchNameError:
		return fuse.ENOENT
	case *libkbfs.BadPathError:
		return fuse.EINVAL
	case *libkbfs.DirNotEmptyError:
		return fuse.Status(syscall.ENOTEMPTY)
	case *libkbfs.RenameAcrossDirsError:
		return fuse.EINVAL
	case *libkbfs.ErrorFileAccessError:
		return fuse.EACCES
	case *libkbfs.ReadAccessError:
		return fuse.EACCES
	case *libkbfs.WriteAccessError:
		return fuse.EACCES
	case *libkbfs.TopDirAccessError:
		return fuse.EACCES
	case *libkbfs.NotDirError:
		return fuse.ENOTDIR
	case *libkbfs.NotFileError:
		return fuse.Status(syscall.EISDIR)
	case *libkbfs.NoSuchMDError:
		return fuse.ENOENT
	case *libkbfs.NewDataVersionError:
		return fuse.Status(syscall.ENOTSUP)
	default:
		return fuse.EIO
	}
}

// OnMount implements the go-fuse Node interface for FuseNode
func (n *FuseNode) OnMount(conn *nodefs.FileSystemConnector) {
	// TODO: check a signature of the favorites
	favs, err := n.Ops.config.MDOps().GetFavorites()
	if err != nil {
		return
	}
	// initialize the favorites in parallel
	// TODO: somehow order to avoid resolving the same name multiple times
	// at once?
	c := make(chan int, len(favs))
	for _, name := range favs {
		go func(fav libkbfs.DirID) {
			n.Ops.LookupInRootByID(n, fav)
			c <- 1
		}(name)
	}
	for i := 0; i < len(favs); i++ {
		<-c
	}
}

func (n *FuseNode) getChans() (rwchan util.RWScheduler, statchan statusChan) {
	rwchan = n.getChan()
	// Use this channel to receive the status codes for each
	// read/write request.  In the cases where other return values are
	// needed, the closure can fill in the named return values of the
	// calling method directly.  By the time a receive on this channel
	// returns, those writes are guaranteed to be visible.  See
	// https://golang.org/ref/mem#tmp_7.
	statchan = make(statusChan)
	return
}

// GetAttr implements the go-fuse Node interface for FuseNode
func (n *FuseNode) GetAttr(
	out *fuse.Attr, file nodefs.File, context *fuse.Context) fuse.Status {
	rwchan, statchan := n.getChans()
	rwchan.QueueReadReq(func() { statchan <- n.Ops.GetAttr(n, out) })
	return <-statchan
}

// Chmod implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Chmod(
	file nodefs.File, perms uint32, context *fuse.Context) (code fuse.Status) {
	if n.Entry.IsInitialized() {
		rwchan, statchan := n.getChans()
		rwchan.QueueWriteReq(func() { statchan <- n.Ops.Chmod(n, perms) })
		return <-statchan
	}
	return fuse.EINVAL
}

// Utimens implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Utimens(file nodefs.File, atime *time.Time,
	mtime *time.Time, context *fuse.Context) (code fuse.Status) {
	if n.Entry.IsInitialized() {
		rwchan, statchan := n.getChans()
		rwchan.QueueWriteReq(func() { statchan <- n.Ops.Utimens(n, mtime) })
		return <-statchan
	}
	return fuse.EINVAL
}

// Lookup implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Lookup(out *fuse.Attr, name string, context *fuse.Context) (
	node *nodefs.Inode, code fuse.Status) {
	if n.PrevNode != nil || n.DirHandle != nil {
		rwchan, statchan := n.getChans()
		rwchan.QueueReadReq(func() {
			node, code = n.Ops.LookupInDir(n, name)
			statchan <- code
		})
		<-statchan
	} else {
		node, code = n.Ops.LookupInRootByName(n, name)
	}
	if node != nil {
		code = node.Node().GetAttr(out, nil, context)
	}
	return
}

// OpenDir implements the go-fuse Node interface for FuseNode
func (n *FuseNode) OpenDir(context *fuse.Context) (
	stream []fuse.DirEntry, code fuse.Status) {
	if n.File != nil {
		return nil, fuse.EINVAL
	} else if n.PrevNode != nil || n.DirHandle != nil {
		rwchan, statchan := n.getChans()
		rwchan.QueueReadReq(func() {
			stream, code = n.Ops.ListDir(n)
			statchan <- code
		})
		<-statchan
		return
	}
	return n.Ops.ListRoot()
}

// Mkdir implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Mkdir(name string, mode uint32, context *fuse.Context) (
	newNode *nodefs.Inode, code fuse.Status) {
	if n.PrevNode != nil || n.DirHandle != nil {
		rwchan, statchan := n.getChans()
		rwchan.QueueWriteReq(func() {
			newNode, code = n.Ops.Mkdir(n, name)
			statchan <- code
		})
		<-statchan
		return
	}
	return nil, fuse.ENOSYS
}

// Mknod implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Mknod(
	name string, mode uint32, dev uint32, context *fuse.Context) (
	newNode *nodefs.Inode, code fuse.Status) {
	if n.PrevNode != nil || n.DirHandle != nil {
		rwchan, statchan := n.getChans()
		rwchan.QueueWriteReq(func() {
			newNode, code = n.Ops.Mknod(n, name, mode)
			statchan <- code
		})
		<-statchan
		return
	}
	return nil, fuse.ENOSYS
}

// Open implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Open(flags uint32, context *fuse.Context) (
	file nodefs.File, code fuse.Status) {
	if n.File != nil {
		return n.File, fuse.OK
	}
	return nil, fuse.EINVAL
}

// Read implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Read(
	file nodefs.File, dest []byte, off int64, context *fuse.Context) (
	res fuse.ReadResult, code fuse.Status) {
	if n.File != nil {
		rwchan, statchan := n.getChans()
		rwchan.QueueReadReq(func() {
			res, code = n.Ops.Read(n, dest, off)
			statchan <- code
		})
		<-statchan
		return
	}
	return nil, fuse.EINVAL
}

// Write implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Write(
	file nodefs.File, data []byte, off int64, context *fuse.Context) (
	written uint32, code fuse.Status) {
	if n.File != nil {
		rwchan, statchan := n.getChans()
		rwchan.QueueWriteReq(func() {
			written, code = n.Ops.Write(n, data, off)
			statchan <- code
		})
		<-statchan
		return
	}
	return 0, fuse.EINVAL
}

// Truncate implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Truncate(
	file nodefs.File, size uint64, context *fuse.Context) (code fuse.Status) {
	if n.File != nil {
		rwchan, statchan := n.getChans()
		rwchan.QueueWriteReq(func() {
			statchan <- n.Ops.Truncate(n, size)
		})
		return <-statchan
	}
	return fuse.EINVAL
}

// Symlink implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Symlink(name string, content string, context *fuse.Context) (
	newNode *nodefs.Inode, code fuse.Status) {
	rwchan, statchan := n.getChans()
	rwchan.QueueWriteReq(func() {
		newNode, code = n.Ops.Symlink(n, name, content)
		statchan <- code
	})
	<-statchan
	return
}

// Readlink implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Readlink(c *fuse.Context) (link []byte, code fuse.Status) {
	if !n.PathNode.IsInitialized() && n.PrevNode != nil {
		rwchan, statchan := n.getChans()
		rwchan.QueueWriteReq(func() {
			link, code = n.Ops.Readlink(n)
			statchan <- code
		})
		<-statchan
		return
	}
	return nil, fuse.EINVAL
}

// Rmdir implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Rmdir(name string, context *fuse.Context) (
	code fuse.Status) {
	if n.File == nil && n.Entry.IsInitialized() {
		rwchan, statchan := n.getChans()
		rwchan.QueueWriteReq(func() {
			statchan <- n.Ops.RmEntry(n, name, true)
		})
		return <-statchan
	}
	return fuse.EINVAL
}

// Unlink implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Unlink(name string, context *fuse.Context) (
	code fuse.Status) {
	if n.File == nil && n.Entry.IsInitialized() {
		rwchan, statchan := n.getChans()
		rwchan.QueueWriteReq(func() {
			statchan <- n.Ops.RmEntry(n, name, false)
		})
		return <-statchan
	}
	return fuse.EINVAL
}

// Rename implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Rename(oldName string, newParent nodefs.Node,
	newName string, context *fuse.Context) (code fuse.Status) {
	newFuseParent := newParent.(*FuseNode)
	if n.File == nil && n.Entry.IsInitialized() &&
		newFuseParent.File == nil && newFuseParent.Entry.IsInitialized() {
		rwchan, statchan := n.getChans()
		rwchan.QueueWriteReq(func() {
			statchan <- n.Ops.Rename(n, oldName, newFuseParent, newName)
		})
		return <-statchan
	}
	return fuse.EINVAL
}

// Flush implements the go-fuse Node interface for FuseNode
func (n *FuseNode) Flush() fuse.Status {
	if n.File != nil {
		rwchan, statchan := n.getChans()
		rwchan.QueueWriteReq(func() {
			statchan <- n.Ops.Flush(n)
		})
		return <-statchan
	}
	return fuse.EINVAL
}

// Read implements the go-fuse Node interface for FuseFile
func (f *FuseFile) Read(dest []byte, off int64) (
	res fuse.ReadResult, code fuse.Status) {
	rwchan, statchan := f.Node.getChans()
	rwchan.QueueReadReq(func() {
		res, code = f.Node.Ops.Read(f.Node, dest, off)
		statchan <- code
	})
	<-statchan
	return
}

// Write implements the go-fuse Node interface for FuseFile
func (f *FuseFile) Write(data []byte, off int64) (
	written uint32, code fuse.Status) {
	rwchan, statchan := f.Node.getChans()
	rwchan.QueueWriteReq(func() {
		written, code = f.Node.Ops.Write(f.Node, data, off)
		statchan <- code
	})
	<-statchan
	return
}

// Flush implements the go-fuse Node interface for FuseFile
func (f *FuseFile) Flush() fuse.Status {
	rwchan, statchan := f.Node.getChans()
	rwchan.QueueWriteReq(func() {
		statchan <- f.Node.Ops.Flush(f.Node)
	})
	return <-statchan
}

func runHanwenFUSE(config *libkbfs.ConfigLocal, debug bool,
	mountpoint string) error {
	root := NewFuseRoot(config)

	server, _, err := nodefs.MountRoot(mountpoint, root, nil)
	if err != nil {
		return err
	}

	if debug {
		server.SetDebug(true)
	}
	server.Serve()
	return nil
}
