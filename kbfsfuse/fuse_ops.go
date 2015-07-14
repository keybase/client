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
	topNodesByID map[libkbfs.TlfID]*FuseNode
	topLock      sync.RWMutex
	tlfRWChans   *libkbfs.TlfRWSchedulers
	ctx          context.Context

	// naturally protected by the dirRWChans
	fuseNodeMap map[libkbfs.NodeID]*FuseNode
}

// NewFuseRoot constructs a new root FUSE node for KBFS.
func NewFuseRoot(ctx context.Context, config libkbfs.Config) *FuseNode {
	f := &FuseOps{
		config:       config,
		topNodes:     make(map[string]*FuseNode),
		topNodesByID: make(map[libkbfs.TlfID]*FuseNode),
		tlfRWChans:   libkbfs.NewTlfRWSchedulers(config),
		fuseNodeMap:  make(map[libkbfs.NodeID]*FuseNode),
	}
	f.ctx = context.WithValue(ctx, ctxAppIDKey, f)
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

	fsNode     libkbfs.Node
	PrevNode   *FuseNode
	Entry      libkbfs.DirEntry
	NeedUpdate bool               // Whether Entry needs to be updated.
	TlfHandle  *libkbfs.TlfHandle // only set if this is a root node
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

func (n *FuseNode) getTlf() libkbfs.TlfID {
	if n.fsNode != nil {
		id := n.fsNode.GetFolderBranch().Tlf
		return id
	}
	// used for the root directory
	return libkbfs.TlfID{0}
}

func (n *FuseNode) getChan() util.RWScheduler {
	return n.Ops.tlfRWChans.GetTlfChan(n.getTlf())
}

// Shutdown cleanly stops any goroutines started by this FuseOps.
func (f *FuseOps) Shutdown() {
	f.tlfRWChans.Shutdown()
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

		// is this the public top-level directory?
		if name == libkbfs.PublicName && dNode.PrevNode == nil &&
			dNode.TlfHandle.HasPublic() {
			dirHandle := &libkbfs.TlfHandle{
				Writers: dNode.TlfHandle.Writers,
				Readers: []keybase1.UID{keybase1.PublicUID},
			}
			rootNode, rootDe, err :=
				f.config.KBFSOps().GetOrCreateRootNodeForHandle(
					f.ctx, dirHandle, libkbfs.MasterBranch)
			if err != nil {
				return nil, f.translateError(err)
			}
			fNode := &FuseNode{
				Node:      nodefs.NewDefaultNode(),
				TlfHandle: dirHandle,
				Entry:     rootDe,
				fsNode:    rootNode,
				Ops:       f,
			}
			f.fuseNodeMap[rootNode.GetID()] = fNode

			node = dNode.Inode().NewChild(name, true, fNode)
			f.topLock.Lock()
			defer f.topLock.Unlock()
			f.addTopNodeLocked(dirHandle.ToString(f.ctx, f.config), fNode)
			return node, fuse.OK
		} else if dNode.getTlf() == libkbfs.NullTlfID {
			uid, err := f.config.KBPKI().GetLoggedInUser(f.ctx)
			if err != nil {
				return nil, f.translateError(err)
			}
			return nil, f.translateError(libkbfs.NewReadAccessError(
				f.ctx, f.config, dNode.TlfHandle, uid))
		}

		newNode, de, err := f.config.KBFSOps().Lookup(f.ctx, dNode.fsNode, name)
		if err != nil {
			return nil, f.translateError(err)
		}

		fNode := &FuseNode{
			Node:     nodefs.NewDefaultNode(),
			fsNode:   newNode,
			PrevNode: dNode,
			Ops:      f,
			Entry:    de,
		}
		f.fuseNodeMap[newNode.GetID()] = fNode
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

// LocalChange sets NeedUpdate for the relevant node.
func (f *FuseOps) LocalChange(
	ctx context.Context, node libkbfs.Node, write libkbfs.WriteRange) {
	f.topLock.RLock()
	defer f.topLock.RUnlock()

	dir := node.GetFolderBranch().Tlf
	topNode := f.topNodesByID[dir]
	if topNode == nil {
		return
	}

	rwchan := topNode.getChan()
	rwchan.QueueWriteReq(func() {
		fNode := f.fuseNodeMap[node.GetID()]
		if fNode == nil {
			return
		}

		fNode.NeedUpdate = true
	})
}

// BatchChanges sets NeedUpdate for all relevant nodes.
func (f *FuseOps) BatchChanges(
	ctx context.Context, changes []libkbfs.NodeChange) {
	if len(changes) == 0 {
		return
	}

	f.topLock.RLock()
	defer f.topLock.RUnlock()

	tlfID := changes[0].Node.GetFolderBranch().Tlf
	topNode := f.topNodesByID[tlfID]
	if topNode == nil {
		return
	}

	rwchan := topNode.getChan()
	rwchan.QueueWriteReq(func() {
		for _, change := range changes {
			fNode := f.fuseNodeMap[change.Node.GetID()]
			if fNode == nil {
				continue
			}
			fNode.NeedUpdate = true
		}
	})
}

func (f *FuseOps) addTopNodeLocked(name string, fNode *FuseNode) {
	f.topNodes[name] = fNode
	id := fNode.getTlf()
	if _, ok := f.topNodesByID[id]; !ok {
		f.config.Notifier().RegisterForChanges([]libkbfs.FolderBranch{
			libkbfs.FolderBranch{Tlf: id, Branch: libkbfs.MasterBranch}}, f)
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
		dirHandle, err := libkbfs.ParseTlfHandle(ctx, f.config, name)
		if err != nil {
			return nil, f.translateError(err)
		} else if dirHandle.IsPublic() {
			// public directories shouldn't be listed directly in root
			return nil, fuse.ENOENT
		}
		f.topLock.Lock()
		defer f.topLock.Unlock()
		dirString := dirHandle.ToString(f.ctx, f.config)
		if fNode, ok := f.topNodes[dirString]; ok {
			node = rNode.Inode().NewChild(name, true, fNode)
		} else {
			rootNode, rootDe, err :=
				f.config.KBFSOps().GetOrCreateRootNodeForHandle(
					f.ctx, dirHandle, libkbfs.MasterBranch)
			var fNode *FuseNode
			if _, ok :=
				err.(libkbfs.ReadAccessError); ok && dirHandle.HasPublic() {
				// This user cannot get the metadata for the folder.
				// But, if it has a public folder, we should still be
				// able to list that public folder, right?  Make a fake
				// node for it.
				fNode = &FuseNode{
					Node:      nodefs.NewDefaultNode(),
					TlfHandle: dirHandle,
					fsNode:    nil,
					Entry:     libkbfs.DirEntry{Type: libkbfs.Dir},
					Ops:       f,
				}
				f.topNodes[dirString] = fNode
				f.topNodes[name] = fNode
			} else {
				if err != nil {
					return nil, f.translateError(err)
				}
				fNode = &FuseNode{
					Node:      nodefs.NewDefaultNode(),
					TlfHandle: dirHandle,
					Entry:     rootDe,
					fsNode:    rootNode,
					Ops:       f,
				}
				f.fuseNodeMap[rootNode.GetID()] = fNode
			}

			node = rNode.Inode().NewChild(name, true, fNode)
			if rootNode != nil {
				f.addTopNodeLocked(dirString, fNode)
			}
		}
	}
	return node, fuse.OK
}

// LookupInRootByID find a top-level folder node in the root KBFS
// mount, given a top-level folder ID.
func (f *FuseOps) LookupInRootByID(rNode *FuseNode, id libkbfs.TlfID) (
	node *nodefs.Inode, code fuse.Status) {
	rootNode, rootDe, dirHandle, err := f.config.KBFSOps().GetRootNode(f.ctx,
		libkbfs.FolderBranch{Tlf: id, Branch: libkbfs.MasterBranch})
	if err != nil {
		return nil, f.translateError(err)
	}

	name := dirHandle.ToString(f.ctx, f.config)

	node = rNode.Inode().GetChild(name)
	if node == nil {
		f.topLock.Lock()
		defer f.topLock.Unlock()

		if fNode, ok := f.topNodes[name]; ok {
			node = rNode.Inode().NewChild(name, true, fNode)
		} else {
			fNode := &FuseNode{
				Node:      nodefs.NewDefaultNode(),
				TlfHandle: dirHandle,
				Entry:     rootDe,
				fsNode:    rootNode,
				Ops:       f,
			}
			f.fuseNodeMap[rootNode.GetID()] = fNode

			node = rNode.Inode().NewChild(name, true, fNode)
			f.addTopNodeLocked(name, fNode)
		}
	}
	return node, fuse.OK
}

// GetAttr returns the attributes for a given KBFS node.
func (f *FuseOps) GetAttr(n *FuseNode, out *fuse.Attr) fuse.Status {
	if n.PrevNode != nil || n.TlfHandle != nil {
		if n.NeedUpdate {
			var de libkbfs.DirEntry
			var err error
			if n.PrevNode != nil {
				// need to fetch the entry anew
				de, err = f.config.KBFSOps().Stat(f.ctx, n.fsNode)
				if err != nil {
					return f.translateError(err)
				}
			} else {
				_, de, err =
					f.config.KBFSOps().GetOrCreateRootNodeForHandle(
						f.ctx, n.TlfHandle, libkbfs.MasterBranch)
				if err != nil {
					return f.translateError(err)
				}
			}

			n.Entry = de
			n.NeedUpdate = false
		}

		out.Size = n.Entry.Size
		out.Mode = fuseModeFromEntry(n.getTlf(), n.Entry.Type)
		mtime := time.Unix(0, n.Entry.Mtime)
		ctime := time.Unix(0, n.Entry.Ctime)
		out.SetTimes(nil, &mtime, &ctime)
	} else {
		out.Mode = fuse.S_IFDIR | 0750
		// TODO: do any other stats make sense in the root?
	}

	return fuse.OK
}

func fuseModeFromEntry(tlfID libkbfs.TlfID, et libkbfs.EntryType) uint32 {
	var pubModeFile, pubModeExec, pubModeDir, pubModeSym uint32
	if tlfID.IsPublic() {
		pubModeFile = 0044
		pubModeExec = 0055
		pubModeDir = 0055
		pubModeSym = 0044
	}

	switch et {
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
	// If this is the top-level folder, then list the public
	// folder as well (if there are no readers)
	hasPublic := n.PrevNode == nil && n.TlfHandle.HasPublic()
	if hasPublic {
		stream = append(stream, fuse.DirEntry{
			Name: libkbfs.PublicName,
			Mode: fuse.S_IFDIR | 0755,
		})
	}

	code = fuse.OK
	if n.fsNode == nil {
		return
	}

	if children, err :=
		f.config.KBFSOps().GetDirChildren(f.ctx, n.fsNode); err != nil {
		code = f.translateError(err)
		if !hasPublic {
			return
		}
	} else {
		id := n.getTlf()
		for name, et := range children {
			stream = append(stream, fuse.DirEntry{
				Name: name,
				Mode: fuseModeFromEntry(id, et),
			})
		}
	}
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
		if fNode.getTlf().IsPublic() {
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
	err := f.config.KBFSOps().SetEx(f.ctx, n.fsNode, ex)
	if err != nil {
		return f.translateError(err)
	}

	return fuse.OK
}

// Utimens sets the mtime for the given KBFS node.
func (f *FuseOps) Utimens(n *FuseNode, mtime *time.Time) (code fuse.Status) {
	err := f.config.KBFSOps().SetMtime(f.ctx, n.fsNode, mtime)
	if err != nil {
		return f.translateError(err)
	}

	return fuse.OK
}

// Mkdir makes a new subdirectory in KBFS.
func (f *FuseOps) Mkdir(n *FuseNode, name string) (
	newNode *nodefs.Inode, code fuse.Status) {
	if name == libkbfs.ErrorFile {
		return nil, f.translateError(libkbfs.ErrorFileAccessError{})
	}

	fsNode, de, err := f.config.KBFSOps().CreateDir(f.ctx, n.fsNode, name)
	if err != nil {
		return nil, f.translateError(err)
	}

	// create a new inode for the new directory
	fNode := &FuseNode{
		Node:     nodefs.NewDefaultNode(),
		fsNode:   fsNode,
		PrevNode: n,
		Entry:    de,
		Ops:      f,
	}
	f.fuseNodeMap[fsNode.GetID()] = fNode
	newNode = n.Inode().NewChild(name, true, fNode)

	code = fuse.OK
	return
}

// Mknod makes a new file in KBFS.
func (f *FuseOps) Mknod(n *FuseNode, name string, mode uint32) (
	newNode *nodefs.Inode, code fuse.Status) {
	if name == libkbfs.ErrorFile {
		return nil, f.translateError(libkbfs.ErrorFileAccessError{})
	}

	fsNode, de, err := f.config.KBFSOps().CreateFile(
		f.ctx, n.fsNode, name, mode&0100 != 0)
	if err != nil {
		return nil, f.translateError(err)
	}

	// create a new inode for the new file
	fNode := &FuseNode{
		Node:     nodefs.NewDefaultNode(),
		fsNode:   fsNode,
		PrevNode: n,
		Entry:    de,
		File:     &FuseFile{File: nodefs.NewDefaultFile()},
		Ops:      f,
	}
	f.fuseNodeMap[fsNode.GetID()] = fNode
	fNode.File.Node = fNode
	newNode = n.Inode().NewChild(name, true, fNode)

	code = fuse.OK
	return
}

// Read reads data from the given KBFS file.
func (f *FuseOps) Read(n *FuseNode, dest []byte, off int64) (
	fuse.ReadResult, fuse.Status) {
	bytes, err := f.config.KBFSOps().Read(f.ctx, n.fsNode, dest, off)
	if err != nil {
		return nil, f.translateError(err)
	}
	return fuse.ReadResultData(dest[:bytes]), fuse.OK
}

// Write writes data to the given KBFS file.
func (f *FuseOps) Write(n *FuseNode, data []byte, off int64) (
	written uint32, code fuse.Status) {
	err := f.config.KBFSOps().Write(f.ctx, n.fsNode, data, off)
	if err != nil {
		return 0, f.translateError(err)
	}
	return uint32(len(data)), fuse.OK
}

// Truncate truncates the size of the given KBFS file.
func (f *FuseOps) Truncate(n *FuseNode, size uint64) (code fuse.Status) {
	err := f.config.KBFSOps().Truncate(f.ctx, n.fsNode, size)
	if err != nil {
		return f.translateError(err)
	}
	return fuse.OK
}

// Symlink creates a new symbolic link in KBFS.
func (f *FuseOps) Symlink(n *FuseNode, name string, content string) (
	newNode *nodefs.Inode, code fuse.Status) {
	if name == libkbfs.ErrorFile {
		return nil, f.translateError(libkbfs.ErrorFileAccessError{})
	}

	de, err := f.config.KBFSOps().CreateLink(f.ctx, n.fsNode, name, content)
	if err != nil {
		return nil, f.translateError(err)
	}

	// create a new inode for the new symlink
	lNode := &FuseNode{
		Node:     nodefs.NewDefaultNode(),
		PrevNode: n,
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
		return f.translateError(libkbfs.ErrorFileAccessError{})
	}

	// Can't remove public directories
	if name == libkbfs.PublicName {
		if n.PrevNode == nil && !n.getTlf().IsPublic() {
			return f.translateError(
				libkbfs.TlfAccessError{ID: n.getTlf()})
		}
	}

	var err error
	if isDir {
		err = f.config.KBFSOps().RemoveDir(f.ctx, n.fsNode, name)
	} else {
		err = f.config.KBFSOps().RemoveEntry(f.ctx, n.fsNode, name)
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
		return f.translateError(libkbfs.ErrorFileAccessError{})
	}

	if oldParent.getTlf() != newParent.getTlf() {
		return f.translateError(libkbfs.RenameAcrossDirsError{})
	}

	err := f.config.KBFSOps().Rename(
		f.ctx, oldParent.fsNode, oldName, newParent.fsNode, newName)
	if err != nil {
		return f.translateError(err)
	}

	childNode := oldParent.Inode().RmChild(oldName)
	childNode.Node().(*FuseNode).PrevNode = newParent
	// remove old one, if it existed
	newParent.Inode().RmChild(newName)
	newParent.Inode().AddChild(newName, childNode)

	return fuse.OK
}

// Flush syncs the given KBFS node.
func (f *FuseOps) Flush(n *FuseNode) fuse.Status {
	err := f.config.KBFSOps().Sync(f.ctx, n.fsNode)
	if err != nil {
		return f.translateError(err)
	}

	return fuse.OK
}

func (f *FuseOps) translateError(err error) fuse.Status {
	f.config.Reporter().Report(libkbfs.RptE, libkbfs.WrapError{Err: err})
	switch err.(type) {
	case libkbfs.NameExistsError:
		return fuse.Status(syscall.EEXIST)
	case libkbfs.NoSuchNameError:
		return fuse.ENOENT
	case libkbfs.BadTLFNameError:
		return fuse.EINVAL
	case libkbfs.InvalidPathError:
		return fuse.EINVAL
	case libkbfs.DirNotEmptyError:
		return fuse.Status(syscall.ENOTEMPTY)
	case libkbfs.RenameAcrossDirsError:
		return fuse.EINVAL
	case libkbfs.ErrorFileAccessError:
		return fuse.EACCES
	case libkbfs.ReadAccessError:
		return fuse.EACCES
	case libkbfs.WriteAccessError:
		return fuse.EACCES
	case libkbfs.TlfAccessError:
		return fuse.EACCES
	case libkbfs.NotDirError:
		return fuse.ENOTDIR
	case libkbfs.NotFileError:
		return fuse.Status(syscall.EISDIR)
	case libkbfs.NoSuchMDError:
		return fuse.ENOENT
	case libkbfs.NewDataVersionError:
		return fuse.Status(syscall.ENOTSUP)
	default:
		return fuse.EIO
	}
}

// OnMount implements the go-fuse Node interface for FuseNode
func (n *FuseNode) OnMount(conn *nodefs.FileSystemConnector) {
	// TODO: check a signature of the favorites
	favs, err := n.Ops.config.KBFSOps().GetFavorites(n.Ops.ctx)
	if err != nil {
		return
	}
	// initialize the favorites in parallel
	// TODO: somehow order to avoid resolving the same name multiple times
	// at once?
	c := make(chan int, len(favs))
	for _, name := range favs {
		go func(fav libkbfs.TlfID) {
			n.Ops.LookupInRootByID(n, fav)
			c <- 1
		}(name)
	}
	for i := 0; i < len(favs); i++ {
		<-c
	}
}

// OnForget implements go-fuse Node interface for FuseNode
func (n *FuseNode) OnForget() {
	rwchan := n.getChan()
	rwchan.QueueWriteReq(func() {
		delete(n.Ops.fuseNodeMap, n.fsNode.GetID())
		n.fsNode = nil
	})
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
	if n.PrevNode != nil || n.TlfHandle != nil {
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
	} else if n.PrevNode != nil || n.TlfHandle != nil {
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
	if n.PrevNode != nil || n.TlfHandle != nil {
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
	if n.PrevNode != nil || n.TlfHandle != nil {
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
	if n.fsNode != nil && n.PrevNode != nil {
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

func runHanwenFUSE(ctx context.Context, config libkbfs.Config, debug bool,
	mountpoint string) error {
	root := NewFuseRoot(ctx, config)

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
