package main

import (
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/hanwen/go-fuse/fuse"
	"github.com/hanwen/go-fuse/fuse/nodefs"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/libkbfs"
)

type ErrorNode struct {
	nodefs.Node

	Ops *FuseOps
}

type FuseOps struct {
	config   libkbfs.Config
	topNodes map[string]*FuseNode
	topLock  sync.RWMutex
	dirLocks *libkbfs.DirLocks
}

func NewFuseRoot(config libkbfs.Config) *FuseNode {
	f := &FuseOps{
		config:   config,
		topNodes: make(map[string]*FuseNode),
		dirLocks: libkbfs.NewDirLocks(config),
	}
	return &FuseNode{
		Node: nodefs.NewDefaultNode(),
		Ops:  f,
	}
}

type FuseFile struct {
	nodefs.File

	Node *FuseNode
}

type FuseNode struct {
	nodefs.Node

	PathNode   *libkbfs.PathNode
	PrevNode   *FuseNode
	Entry      *libkbfs.DirEntry // assumes no hard links
	NeedUpdate bool
	Dir        libkbfs.DirId      // only set if this is a root node
	DirHandle  *libkbfs.DirHandle // only set if this is a root node
	File       *FuseFile
	Ops        *FuseOps
}

func (n *ErrorNode) GetAttr(
	out *fuse.Attr, file nodefs.File, context *fuse.Context) fuse.Status {
	data, etime := n.Ops.config.Reporter().LastError()
	out.Size = uint64(len(data)) + 1 // we'll add in a newline
	out.Mode = fuse.S_IFREG | 0444
	out.SetTimes(nil, etime, etime)
	return fuse.OK
}

func (n *ErrorNode) Open(flags uint32, context *fuse.Context) (
	file nodefs.File, code fuse.Status) {
	return nil, fuse.OK
}

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

func (n *FuseNode) GetLock() *sync.RWMutex {
	if n.PrevNode == nil {
		return n.Ops.dirLocks.GetDirLock(n.Dir)
	} else {
		return n.PrevNode.GetLock()
	}
}

func (n *FuseNode) GetPath(depth int) libkbfs.Path {
	var p libkbfs.Path
	if n.PrevNode == nil {
		p = libkbfs.Path{n.Dir, make([]*libkbfs.PathNode, 0, depth)}
	} else {
		p = n.PrevNode.GetPath(depth + 1)
	}
	p.Path = append(p.Path, n.PathNode)
	return p
}

func (f *FuseOps) LookupInDir(dNode *FuseNode, name string) (
	node *nodefs.Inode, code fuse.Status) {
	lock := dNode.GetLock()
	lock.RLock()
	defer lock.RUnlock()

	node = dNode.Inode().GetChild(name)
	if node == nil {
		if name == libkbfs.ErrorFile {
			return dNode.Inode().NewChild(name, false, &ErrorNode{
				Node: nodefs.NewDefaultNode(),
				Ops:  f,
			}), fuse.OK
		}

		p := dNode.GetPath(1)

		// is this the public top-level directory?
		if name == libkbfs.PublicName && p.HasPublic() &&
			dNode.DirHandle.HasPublic() {
			dirHandle := &libkbfs.DirHandle{
				Writers: dNode.DirHandle.Writers,
				Readers: []libkb.UID{libkbfs.PublicUid},
			}
			md, err := f.config.KBFSOps().GetRootMDForHandle(dirHandle)
			if err != nil {
				return nil, f.TranslateError(err)
			}
			fNode := &FuseNode{
				Node:      nodefs.NewDefaultNode(),
				Dir:       md.Id,
				DirHandle: dirHandle,
				Entry:     &md.Data().Dir,
				PathNode: &libkbfs.PathNode{
					md.Data().Dir.BlockPointer,
					dirHandle.ToString(f.config),
				},
				Ops: f,
			}

			node = dNode.Inode().NewChild(name, true, fNode)
			return node, fuse.OK
		}

		dBlock, err := f.config.KBFSOps().GetDir(p)
		if err != nil {
			return nil, f.TranslateError(err)
		}

		de, ok := dBlock.Children[name]
		if !ok {
			return nil, f.TranslateError(&libkbfs.NoSuchNameError{name})
		}

		var pathNode *libkbfs.PathNode = nil
		if !de.IsSym {
			pathNode = &libkbfs.PathNode{de.BlockPointer, name}
		} else {
			// use a null block pointer for symlinks
			pathNode = &libkbfs.PathNode{Name: name}
		}
		fNode := &FuseNode{
			Node:     nodefs.NewDefaultNode(),
			PathNode: pathNode,
			PrevNode: dNode,
			Ops:      f,
			Entry:    de,
		}
		if !de.IsDir {
			fNode.File = &FuseFile{
				File: nodefs.NewDefaultFile(),
				Node: fNode,
			}
		}
		node = dNode.Inode().NewChild(name, de.IsDir, fNode)
	}

	return node, fuse.OK
}

func (f *FuseOps) resolveName(input string) (libkb.UID, error) {
	if user, err := f.config.KBPKI().ResolveAssertion(input); err != nil {
		return libkb.UID{0}, err
	} else {
		return user.GetUid(), nil
	}
}

type resolveAnswer struct {
	uid libkb.UID
	err error
}

func (f *FuseOps) resolve(name string, c chan *resolveAnswer) {
	uid, err := f.resolveName(name)
	answer := &resolveAnswer{uid, err}
	c <- answer
}

func process(answer *resolveAnswer, users *libkbfs.UIDList,
	usedNames *map[libkb.UID]bool) error {
	if answer.err != nil {
		return answer.err
	}
	if !(*usedNames)[answer.uid] {
		*users = append(*users, answer.uid)
		(*usedNames)[answer.uid] = true
	}
	return nil
}

func (f *FuseOps) resolveNames(name string) (*libkbfs.DirHandle, error) {
	splitNames := strings.Split(name, libkbfs.ReaderSep)
	if len(splitNames) > 2 {
		return nil, &libkbfs.BadPathError{name}
	}
	writerNames := strings.Split(splitNames[0], ",")
	var readerNames []string
	if len(splitNames) > 1 {
		readerNames = strings.Split(splitNames[1], ",")
	} else {
		readerNames = make([]string, 0, 0)
	}
	d := &libkbfs.DirHandle{
		Writers: make(libkbfs.UIDList, 0, len(writerNames)),
		Readers: make(libkbfs.UIDList, 0, len(readerNames)),
	}

	// parallelize the resolutions for each user
	wc := make(chan *resolveAnswer, len(writerNames))
	rc := make(chan *resolveAnswer, len(readerNames))
	for _, user := range writerNames {
		go f.resolve(user, wc)
	}

	for _, user := range readerNames {
		go f.resolve(user, rc)
	}

	usedWNames := make(map[libkb.UID]bool)
	usedRNames := make(map[libkb.UID]bool)
	for i := 0; i < len(writerNames)+len(readerNames); i++ {
		select {
		case answer := <-wc:
			if err := process(answer, &d.Writers, &usedWNames); err != nil {
				return nil, err
			}
		case answer := <-rc:
			if err := process(answer, &d.Readers, &usedRNames); err != nil {
				return nil, err
			}
		}
	}

	if len(readerNames) > 0 {
		// make sure no writers appear as readers, they are already
		// implied readers
		newReaders := make(libkbfs.UIDList, 0, len(readerNames))
		for _, uid := range d.Readers {
			if !usedWNames[uid] {
				newReaders = append(newReaders, uid)
			}
		}
		d.Readers = newReaders
	}

	sort.Sort(d.Writers)
	sort.Sort(d.Readers)
	return d, nil
}

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
		dirHandle, err := f.resolveNames(name)
		if err != nil {
			return nil, f.TranslateError(err)
		} else if dirHandle.IsPublic() {
			// public directories shouldn't be listed directly in root
			return nil, fuse.ENOENT
		}
		f.topLock.Lock()
		defer f.topLock.Unlock()
		dirString := dirHandle.ToString(f.config)
		if fNode, ok := f.topNodes[dirString]; ok {
			node = rNode.Inode().NewChild(name, true, fNode)
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
					PathNode: &libkbfs.PathNode{
						libkbfs.BlockPointer{}, dirString},
					Entry: &libkbfs.DirEntry{IsDir: true},
					Ops:   f,
				}
			} else if err != nil {
				return nil, f.TranslateError(err)
			} else {
				fNode = &FuseNode{
					Node:      nodefs.NewDefaultNode(),
					Dir:       md.Id,
					DirHandle: dirHandle,
					Entry:     &md.Data().Dir,
					PathNode: &libkbfs.PathNode{
						md.Data().Dir.BlockPointer,
						dirString,
					},
					Ops: f,
				}
			}

			node = rNode.Inode().NewChild(name, true, fNode)
			f.topNodes[dirString] = fNode
		}
	}
	return node, fuse.OK
}

func (f *FuseOps) LookupInRootById(rNode *FuseNode, id libkbfs.DirId) (
	node *nodefs.Inode, code fuse.Status) {
	md, err := f.config.KBFSOps().GetRootMD(id)
	if err != nil {
		return nil, f.TranslateError(err)
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
				Entry:     &md.Data().Dir,
				PathNode: &libkbfs.PathNode{
					md.Data().Dir.BlockPointer,
					name,
				},
				Ops: f,
			}

			node = rNode.Inode().NewChild(name, true, fNode)
			f.topNodes[name] = fNode
		}
	}
	return node, fuse.OK
}

func fuseModeFromEntry(dir libkbfs.DirId, de *libkbfs.DirEntry) uint32 {
	pubModeFile := uint32(0)
	pubModeDir := uint32(0)
	if dir.IsPublic() {
		pubModeFile = 0044
		pubModeDir = 0055
	}

	if de.IsDir {
		return fuse.S_IFDIR | 0750 | pubModeDir
	} else if de.IsSym {
		return fuse.S_IFLNK | 0640 | pubModeFile
	} else if de.IsExec {
		return fuse.S_IFREG | 0750 | pubModeDir
	} else {
		return fuse.S_IFREG | 0640 | pubModeFile
	}
}

func (f *FuseOps) ListDir(n *FuseNode) (
	stream []fuse.DirEntry, code fuse.Status) {
	lock := n.GetLock()
	lock.RLock()
	defer lock.RUnlock()

	p := n.GetPath(1)

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
		code = f.TranslateError(err)
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

func (f *FuseOps) ListRoot() (stream []fuse.DirEntry, code fuse.Status) {
	f.topLock.RLock()
	defer f.topLock.RUnlock()
	stream = make([]fuse.DirEntry, 0, len(f.topNodes))
	for tn, _ := range f.topNodes {
		stream = append(stream, fuse.DirEntry{
			Name: tn,
			Mode: fuse.S_IFDIR | 0750,
		})
	}

	code = fuse.OK
	return
}

func (f *FuseOps) updatePaths(topDir libkbfs.DirId, n *FuseNode,
	newPath []*libkbfs.PathNode) {
	// update all the paths back to the root
	index := len(newPath) - 1
	currNode := n
	for index >= 0 && currNode != nil {
		currNode.PathNode = newPath[index]
		index -= 1
		currNode = currNode.PrevNode
	}
}

func (f *FuseOps) Chmod(n *FuseNode, perms uint32) (code fuse.Status) {
	doSetEx := perms&0100 > 0

	lock := n.GetLock()
	lock.Lock()
	defer lock.Unlock()

	if doSetEx != n.Entry.IsExec {
		p := n.GetPath(1)
		newPath, err := f.config.KBFSOps().SetEx(p, doSetEx)
		if err != nil {
			return f.TranslateError(err)
		}

		f.updatePaths(p.TopDir, n, newPath.Path)
		n.NeedUpdate = true
	}
	return fuse.OK
}

func (f *FuseOps) Utimens(n *FuseNode, mtime *time.Time) (code fuse.Status) {
	lock := n.GetLock()
	lock.Lock()
	defer lock.Unlock()

	p := n.GetPath(1)
	newPath, err := f.config.KBFSOps().SetMtime(p, mtime)
	if err != nil {
		return f.TranslateError(err)
	}

	f.updatePaths(p.TopDir, n, newPath.Path)
	n.NeedUpdate = true
	return fuse.OK
}

func (f *FuseOps) Mkdir(n *FuseNode, name string) (
	newNode *nodefs.Inode, code fuse.Status) {
	lock := n.GetLock()
	lock.Lock()
	defer lock.Unlock()

	if name == libkbfs.ErrorFile {
		return nil, f.TranslateError(&libkbfs.ErrorFileAccessError{})
	}

	p := n.GetPath(1)
	newPath, de, err := f.config.KBFSOps().CreateDir(p, name)
	if err != nil {
		return nil, f.TranslateError(err)
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

	// update the parent directories
	f.updatePaths(p.TopDir, n, newPath.Path[:len(newPath.Path)-1])

	code = fuse.OK
	return
}

func (f *FuseOps) Mknod(n *FuseNode, name string, mode uint32) (
	newNode *nodefs.Inode, code fuse.Status) {
	lock := n.GetLock()
	lock.Lock()
	defer lock.Unlock()

	if name == libkbfs.ErrorFile {
		return nil, f.TranslateError(&libkbfs.ErrorFileAccessError{})
	}

	p := n.GetPath(1)
	newPath, de, err := f.config.KBFSOps().CreateFile(p, name, mode&0100 != 0)
	if err != nil {
		return nil, f.TranslateError(err)
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

	// update the parent directories
	f.updatePaths(p.TopDir, n, newPath.Path[:len(newPath.Path)-1])

	code = fuse.OK
	return
}

func (f *FuseOps) Read(n *FuseNode, dest []byte, off int64) (
	fuse.ReadResult, fuse.Status) {
	lock := n.GetLock()
	lock.RLock()
	defer lock.RUnlock()

	p := n.GetPath(1)
	bytes, err := f.config.KBFSOps().Read(p, dest, off)
	if err != nil {
		return nil, f.TranslateError(err)
	}
	return fuse.ReadResultData(dest[:bytes]), fuse.OK
}

func (f *FuseOps) Write(n *FuseNode, data []byte, off int64) (
	written uint32, code fuse.Status) {
	lock := n.GetLock()
	lock.RLock()
	defer lock.RUnlock()

	p := n.GetPath(1)
	err := f.config.KBFSOps().Write(p, data, off)
	if err != nil {
		return 0, f.TranslateError(err)
	}
	n.NeedUpdate = true
	return uint32(len(data)), fuse.OK
}

func (f *FuseOps) Truncate(n *FuseNode, size uint64) (code fuse.Status) {
	lock := n.GetLock()
	lock.RLock()
	defer lock.RUnlock()

	p := n.GetPath(1)
	err := f.config.KBFSOps().Truncate(p, size)
	if err != nil {
		return f.TranslateError(err)
	} else {
		n.NeedUpdate = true
		return fuse.OK
	}
}

func (f *FuseOps) Symlink(n *FuseNode, name string, content string) (
	newNode *nodefs.Inode, code fuse.Status) {
	lock := n.GetLock()
	lock.Lock()
	defer lock.Unlock()

	if name == libkbfs.ErrorFile {
		return nil, f.TranslateError(&libkbfs.ErrorFileAccessError{})
	}

	p := n.GetPath(1)
	newPath, de, err := f.config.KBFSOps().CreateLink(p, name, content)
	if err != nil {
		return nil, f.TranslateError(err)
	}

	// create a new inode for the new directory
	lNode := &FuseNode{
		Node:     nodefs.NewDefaultNode(),
		PrevNode: n,
		PathNode: &libkbfs.PathNode{Name: name},
		Entry:    de,
		Ops:      f,
	}
	newNode = n.Inode().NewChild(name, false, lNode)

	// update the parent directories
	f.updatePaths(p.TopDir, n, newPath.Path)

	code = fuse.OK
	return
}

func (f *FuseOps) Readlink(n *FuseNode) ([]byte, fuse.Status) {
	return []byte(n.Entry.SymPath), fuse.OK
}

func (f *FuseOps) RmEntry(n *FuseNode, name string, isDir bool) (
	code fuse.Status) {
	lock := n.GetLock()
	lock.Lock()
	defer lock.Unlock()

	if name == libkbfs.ErrorFile {
		return f.TranslateError(&libkbfs.ErrorFileAccessError{})
	}

	child := n.Inode().GetChild(name)
	var p libkbfs.Path
	if child == nil {
		p = n.GetPath(1)
		// make a fake pathnode for this name
		p.Path = append(p.Path, &libkbfs.PathNode{Name: name})
	} else {
		p = child.Node().(*FuseNode).GetPath(1)
	}

	// Can't remove public directories
	if name == libkbfs.PublicName {
		if parentPath := n.GetPath(1); parentPath.HasPublic() {
			return f.TranslateError(&libkbfs.TopDirAccessError{p})
		}
	}

	var newPath libkbfs.Path
	var err error
	if isDir {
		newPath, err = f.config.KBFSOps().RemoveDir(p)
	} else {
		newPath, err = f.config.KBFSOps().RemoveEntry(p)
	}
	if err != nil {
		return f.TranslateError(err)
	}

	f.updatePaths(p.TopDir, n, newPath.Path)

	// clear out the inode if it exists
	n.Inode().RmChild(name)

	return fuse.OK
}

func (f *FuseOps) Rename(
	oldParent *FuseNode, oldName string, newParent *FuseNode, newName string) (
	code fuse.Status) {
	lock := oldParent.GetLock()
	lock.Lock()
	defer lock.Unlock()

	if oldName == libkbfs.ErrorFile || newName == libkbfs.ErrorFile {
		return f.TranslateError(&libkbfs.ErrorFileAccessError{})
	}

	oldPath := oldParent.GetPath(1)
	newPath := newParent.GetPath(1)

	if oldPath.TopDir != newPath.TopDir {
		return f.TranslateError(&libkbfs.RenameAcrossDirsError{})
	}

	newOldPath, newNewPath, err := f.config.KBFSOps().Rename(
		oldPath, oldName, newPath, newName)
	if err != nil {
		return f.TranslateError(err)
	}

	f.updatePaths(oldPath.TopDir, oldParent, newOldPath.Path)
	f.updatePaths(newPath.TopDir, newParent, newNewPath.Path)

	childNode := oldParent.Inode().RmChild(oldName)
	childNode.Node().(*FuseNode).PathNode.Name = newName
	childNode.Node().(*FuseNode).PrevNode = newParent
	// remove old one, if it existed
	newParent.Inode().RmChild(newName)
	newParent.Inode().AddChild(newName, childNode)

	return fuse.OK
}

func (f *FuseOps) Flush(n *FuseNode) fuse.Status {
	lock := n.GetLock()
	lock.Lock()
	defer lock.Unlock()

	p := n.GetPath(1)
	newPath, err := f.config.KBFSOps().Sync(p)
	if err != nil {
		return f.TranslateError(err)
	}

	f.updatePaths(p.TopDir, n, newPath.Path)
	n.NeedUpdate = true
	return fuse.OK
}

func (f *FuseOps) TranslateError(err error) fuse.Status {
	f.config.Reporter().Report(libkbfs.RptE, &libkbfs.WrapError{err})
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
	case *libkbfs.NewVersionError:
		return fuse.Status(syscall.ENOTSUP)
	default:
		return fuse.EIO
	}
}

func (n *FuseNode) OnMount(conn *nodefs.FileSystemConnector) {
	// TODO: check a signature of the favories
	favs, err := n.Ops.config.MDOps().GetFavorites()
	if err != nil {
		return
	}
	// initialize the favorites in parallel
	// TODO: somehow order to avoid resolving the same name multiple times
	// at once?
	c := make(chan int, len(favs))
	for _, name := range favs {
		go func(fav libkbfs.DirId) {
			n.Ops.LookupInRootById(n, fav)
			c <- 1
		}(name)
	}
	for i := 0; i < len(favs); i++ {
		<-c
	}
}

func (n *FuseNode) GetAttr(
	out *fuse.Attr, file nodefs.File, context *fuse.Context) fuse.Status {
	if n.PrevNode != nil || n.DirHandle != nil {
		lock := n.GetLock()
		lock.RLock()
		defer lock.RUnlock()

		p := n.GetPath(1)
		if n.NeedUpdate {
			// need to fetch the entry anew
			dBlock, err := n.Ops.config.KBFSOps().GetDir(*p.ParentPath())
			if err != nil {
				return n.Ops.TranslateError(err)
			}

			name := p.TailName()
			de, ok := dBlock.Children[name]
			if !ok {
				return n.Ops.TranslateError(&libkbfs.NoSuchNameError{name})
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

func (n *FuseNode) Chmod(
	file nodefs.File, perms uint32, context *fuse.Context) (code fuse.Status) {
	if n.Entry != nil {
		return n.Ops.Chmod(n, perms)
	} else {
		return fuse.EINVAL
	}
}

func (n *FuseNode) Utimens(file nodefs.File, atime *time.Time,
	mtime *time.Time, context *fuse.Context) (code fuse.Status) {
	if n.Entry != nil {
		return n.Ops.Utimens(n, mtime)
	} else {
		return fuse.EINVAL
	}
}

func (n *FuseNode) Lookup(out *fuse.Attr, name string, context *fuse.Context) (
	node *nodefs.Inode, code fuse.Status) {
	if n.PrevNode != nil || n.DirHandle != nil {
		node, code = n.Ops.LookupInDir(n, name)
	} else {
		node, code = n.Ops.LookupInRootByName(n, name)
	}
	if node != nil {
		code = node.Node().GetAttr(out, nil, context)
	}
	return
}

func (n *FuseNode) OpenDir(context *fuse.Context) (
	stream []fuse.DirEntry, code fuse.Status) {
	if n.File != nil {
		return nil, fuse.EINVAL
	} else if n.PrevNode != nil || n.DirHandle != nil {
		return n.Ops.ListDir(n)
	} else {
		return n.Ops.ListRoot()
	}
}

func (n *FuseNode) Mkdir(name string, mode uint32, context *fuse.Context) (
	newNode *nodefs.Inode, code fuse.Status) {
	if n.PrevNode != nil || n.DirHandle != nil {
		return n.Ops.Mkdir(n, name)
	} else {
		return nil, fuse.ENOSYS
	}
}

func (n *FuseNode) Mknod(
	name string, mode uint32, dev uint32, context *fuse.Context) (
	newNode *nodefs.Inode, code fuse.Status) {
	if n.PrevNode != nil || n.DirHandle != nil {
		return n.Ops.Mknod(n, name, mode)
	} else {
		return nil, fuse.ENOSYS
	}
}

func (n *FuseNode) Open(flags uint32, context *fuse.Context) (
	file nodefs.File, code fuse.Status) {
	if n.File != nil {
		return n.File, fuse.OK
	} else {
		return nil, fuse.EINVAL
	}
}

func (n *FuseNode) Read(
	file nodefs.File, dest []byte, off int64, context *fuse.Context) (
	fuse.ReadResult, fuse.Status) {
	if n.File != nil {
		return n.Ops.Read(n, dest, off)
	} else {
		return nil, fuse.EINVAL
	}
}

func (n *FuseNode) Write(
	file nodefs.File, data []byte, off int64, context *fuse.Context) (
	written uint32, code fuse.Status) {
	if n.File != nil {
		return n.Ops.Write(n, data, off)
	} else {
		return 0, fuse.EINVAL
	}
}

func (n *FuseNode) Truncate(
	file nodefs.File, size uint64, context *fuse.Context) (code fuse.Status) {
	if n.File != nil {
		return n.Ops.Truncate(n, size)
	} else {
		return fuse.EINVAL
	}
}

func (n *FuseNode) Symlink(name string, content string, context *fuse.Context) (
	*nodefs.Inode, fuse.Status) {
	return n.Ops.Symlink(n, name, content)
}

func (n *FuseNode) Readlink(c *fuse.Context) ([]byte, fuse.Status) {
	if n.PathNode == nil && n.PrevNode != nil {
		return n.Ops.Readlink(n)
	} else {
		return nil, fuse.EINVAL
	}
}

func (n *FuseNode) Rmdir(name string, context *fuse.Context) (
	code fuse.Status) {
	if n.File == nil && n.Entry != nil {
		return n.Ops.RmEntry(n, name, true)
	} else {
		return fuse.EINVAL
	}
}

func (n *FuseNode) Unlink(name string, context *fuse.Context) (
	code fuse.Status) {
	if n.File == nil && n.Entry != nil {
		return n.Ops.RmEntry(n, name, false)
	} else {
		return fuse.EINVAL
	}
}

func (n *FuseNode) Rename(oldName string, newParent nodefs.Node,
	newName string, context *fuse.Context) (code fuse.Status) {
	newFuseParent := newParent.(*FuseNode)
	if n.File == nil && n.Entry != nil &&
		newFuseParent.File == nil && newFuseParent.Entry != nil {
		return n.Ops.Rename(n, oldName, newFuseParent, newName)
	} else {
		return fuse.EINVAL
	}
}

func (n *FuseNode) Flush() fuse.Status {
	if n.File != nil {
		return n.Ops.Flush(n)
	} else {
		return fuse.EINVAL
	}
}

func (f *FuseFile) Read(dest []byte, off int64) (fuse.ReadResult, fuse.Status) {
	return f.Node.Ops.Read(f.Node, dest, off)
}

func (f *FuseFile) Write(data []byte, off int64) (
	written uint32, code fuse.Status) {
	return f.Node.Ops.Write(f.Node, data, off)
}

func (f *FuseFile) Flush() fuse.Status {
	return f.Node.Ops.Flush(f.Node)
}
