package libkbfs

import (
	"math/rand"
	"time"
)

// KBFSOpsStandard implements the KBFS interface, and is go-routine
// safe by using per-top-level-directory read-write locks
type KBFSOpsStandard struct {
	config   Config
	dirLocks *DirLocks
}

func NewKBFSOpsStandard(config Config) *KBFSOpsStandard {
	return &KBFSOpsStandard{
		config:   config,
		dirLocks: NewDirLocks(config),
	}
}

func (fs *KBFSOpsStandard) GetFavDirs() ([]DirId, error) {
	mdops := fs.config.MDOps()
	return mdops.GetFavorites()
}

func (fs *KBFSOpsStandard) getMDLocked(dir Path) (*RootMetadata, error) {
	ver := dir.TailPointer().GetVer()
	if ver > fs.config.DataVersion() {
		return nil, &NewVersionError{dir.ToString(fs.config), ver}
	}

	mdcache := fs.config.MDCache()
	if md, err := mdcache.Get(dir.TopDir); err == nil {
		return md, nil
	}

	// not in cache, fetch from server and add to cache
	mdops := fs.config.MDOps()
	if md, err := mdops.Get(dir.TopDir); err == nil {
		return md, mdcache.Put(dir.TopDir, md)
	} else {
		return nil, err
	}
}

func (fs *KBFSOpsStandard) getMDForReadLocked(dir Path) (*RootMetadata, error) {
	md, err := fs.getMDLocked(dir)
	if err != nil {
		return nil, err
	}

	user, err := fs.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return nil, err
	}
	if !md.GetDirHandle().IsReader(user) {
		return nil, readAccessError(fs.config, md, user)
	}
	return md, nil
}

func (fs *KBFSOpsStandard) getMDForWriteLocked(dir Path) (
	*RootMetadata, error) {
	md, err := fs.getMDLocked(dir)
	if err != nil {
		return nil, err
	}

	user, err := fs.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return nil, err
	}
	if !md.GetDirHandle().IsWriter(user) {
		return nil, writeAccessError(fs.config, md, user)
	}
	return md, nil
}

func (fs *KBFSOpsStandard) initMDLocked(md *RootMetadata) error {
	// create a dblock since one doesn't exist yet
	user, err := fs.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return err
	}
	newDblock := &DirBlock{
		CommonBlock: CommonBlock{
			Seed: rand.Int63(),
		},
		Children: make(map[string]*DirEntry),
	}

	// create a new set of keys for this metadata
	if err := fs.config.KeyManager().Rekey(md); err != nil {
		return nil
	}

	path := Path{md.Id, []*PathNode{&PathNode{
		BlockPointer{BlockId{}, 0, fs.config.DataVersion(), user, 0},
		md.GetDirHandle().ToString(fs.config),
	}}}
	encryptKey, err := fs.config.KeyManager().GetSecretKey(path, md)
	if err != nil {
		return err
	}
	id, buf, err := fs.config.BlockOps().Ready(newDblock, encryptKey)
	if err != nil {
		return err
	}
	md.data.Dir.Id = id
	md.data.Dir.IsDir = true
	md.data.Dir.Writer = user
	md.data.Dir.KeyId = 0
	md.data.Dir.Ver = fs.config.DataVersion()

	// make sure we're a writer before putting any blocks
	if !md.GetDirHandle().IsWriter(user) {
		return writeAccessError(fs.config, md, user)
	}

	if err = fs.config.BlockOps().Put(id, &md.data.Dir, buf); err != nil {
		return err
	}
	if err = fs.config.BlockCache().Put(id, newDblock, false); err != nil {
		return err
	}

	// finally, write out the new metadata
	md.data.LastWriter = user
	if err = fs.config.MDOps().Put(md.Id, md); err != nil {
		return err
	}
	if err = fs.config.MDCache().Put(md.Id, md); err != nil {
		return err
	}
	return nil
}

func (fs *KBFSOpsStandard) GetRootMDForHandle(dirHandle *DirHandle) (
	*RootMetadata, error) {
	// Do GetAtHandle() unlocked -- no cache lookups, should be fine
	mdops := fs.config.MDOps()
	if md, err := mdops.GetAtHandle(dirHandle); err == nil {
		// IsDir defaults to false, so if it was set to true then MD
		// already exists
		if !md.data.Dir.IsDir {
			lock := fs.dirLocks.GetDirLock(md.Id)
			lock.Lock()
			defer lock.Unlock()
			err = fs.initMDLocked(md)
		}
		return md, err
	} else {
		return nil, err
	}
}

func (fs *KBFSOpsStandard) GetRootMD(dir DirId) (*RootMetadata, error) {
	lock := fs.dirLocks.GetDirLock(dir)
	lock.RLock()

	// don't check read permissions here -- anyone should be able to read
	// the MD to determine whether there's a public subdir or not
	md, err := fs.getMDLocked(Path{TopDir: dir})
	// IsDir defaults to false, so if it was set to true then MD already exists
	if err != nil || md.data.Dir.IsDir {
		lock.RUnlock()
		return md, err
	}

	// lock for writing now
	lock.RUnlock()
	lock.Lock()
	defer lock.Unlock()

	// refetch just in case
	md, err = fs.getMDForWriteLocked(Path{TopDir: dir})
	if err != nil || md.data.Dir.IsDir {
		return md, err
	}

	return md, fs.initMDLocked(md)
}

type makeNewBlock func() Block

func (fs *KBFSOpsStandard) getBlockLocked(
	dir Path, id BlockId, newBlock makeNewBlock) (
	Block, error) {
	ver := dir.TailPointer().GetVer()
	if ver > fs.config.DataVersion() {
		return nil, &NewVersionError{dir.ToString(fs.config), ver}
	}

	bcache := fs.config.BlockCache()
	if block, err := bcache.Get(id); err == nil {
		return block, nil
	} else {
		// fetch the block, and add to cache
		bops := fs.config.BlockOps()
		block := newBlock()
		if md, err := fs.getMDLocked(dir); err != nil {
			return nil, err
		} else if k, err :=
			fs.config.KeyManager().GetSecretBlockKey(dir, id, md); err != nil {
			return nil, err
		} else if err := bops.Get(id, dir.TailPointer(), k, block); err != nil {
			return nil, err
		} else if err := fs.config.BlockCache().Put(
			id, block, false); err != nil {
			return nil, err
		} else {
			return block, nil
		}
	}
}

func (fs *KBFSOpsStandard) getDirLocked(dir Path, forWriting bool) (
	*DirBlock, error) {
	if _, err := fs.getMDForReadLocked(dir); err != nil {
		return nil, err
	}

	// get the directory for the last element in the path
	id := dir.TailPointer().Id
	if block, err := fs.getBlockLocked(dir, id, NewDirBlock); err == nil {
		if dblock, ok := block.(*DirBlock); ok {
			if forWriting && !fs.config.BlockCache().IsDirty(id) {
				// copy the block if it's for writing
				dblockCopy := NewDirBlock().(*DirBlock)
				*dblockCopy = *dblock
				dblock = dblockCopy
			}
			return dblock, nil
		} else {
			return nil, &NotDirError{dir.ToString(fs.config)}
		}
	} else {
		return nil, err
	}
}

func (fs *KBFSOpsStandard) getFileLocked(dir Path, forWriting bool) (
	*FileBlock, error) {
	if _, err := fs.getMDForReadLocked(dir); err != nil {
		return nil, err
	}

	// get the directory for the last element in the path
	id := dir.TailPointer().Id
	if block, err := fs.getBlockLocked(dir, id, NewFileBlock); err == nil {
		if fblock, ok := block.(*FileBlock); ok {
			if forWriting && !fs.config.BlockCache().IsDirty(id) {
				// copy the block if it's for writing
				fblockCopy := NewFileBlock().(*FileBlock)
				*fblockCopy = *fblock
				fblock = fblockCopy
			}
			return fblock, nil
		} else {
			return nil, &NotFileError{dir.ToString(fs.config)}
		}
	} else {
		return nil, err
	}
}

func (fs *KBFSOpsStandard) GetDir(dir Path) (*DirBlock, error) {
	lock := fs.dirLocks.GetDirLock(dir.TopDir)
	lock.RLock()
	defer lock.RUnlock()

	return fs.getDirLocked(dir, false)
}

var zeroId BlockId

// TODO: deal with multiple nodes for indirect blocks
func (fs *KBFSOpsStandard) syncBlockLocked(
	newBlock Block, dir Path, name string, isDir bool, isExec bool,
	mtime bool, ctime bool, stopAt BlockId) (Path, *DirEntry, error) {
	user, err := fs.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return Path{}, nil, err
	}
	md, err := fs.getMDLocked(dir)
	if err != nil {
		return Path{}, nil, err
	}
	encryptKey, err := fs.config.KeyManager().GetSecretKey(dir, md)
	if err != nil {
		return Path{}, nil, err
	}

	// now ready each dblock and write the DirEntry for the next one
	// in the path
	currBlock := newBlock
	currName := name
	newPath := Path{dir.TopDir, make([]*PathNode, 0, len(dir.Path))}
	blockIdsToPut := make([]BlockId, 0, len(dir.Path))
	blocksToPut := make([]Block, 0, len(dir.Path))
	blockContextsToPut := make([]BlockContext, 0, len(dir.Path))
	bufsToPut := make([][]byte, 0, len(dir.Path))
	crypto := fs.config.Crypto()
	kops := fs.config.KeyOps()
	kcache := fs.config.KeyCache()
	var newDe *DirEntry
	for len(newPath.Path) < len(dir.Path)+1 {
		// new key for the block
		blockServKey := crypto.GenRandomSecretKey()
		blockKey, err := crypto.XOR(blockServKey, encryptKey)
		if err != nil {
			return Path{}, nil, err
		}

		id, buf, err := fs.config.BlockOps().Ready(currBlock, blockKey)
		if err != nil {
			return Path{}, nil, err
		}
		blockIdsToPut = append(blockIdsToPut, id)
		blocksToPut = append(blocksToPut, currBlock)
		bufsToPut = append(bufsToPut, buf)
		keyId := md.LatestKeyId()

		// store the keys
		if err := kops.PutBlockKey(id, blockServKey); err != nil {
			return Path{}, nil, err
		} else if err := kcache.PutBlockKey(id, blockKey); err != nil {
			return Path{}, nil, err
		}

		// prepend to path and setup next one
		newPath.Path = append([]*PathNode{&PathNode{
			BlockPointer{id, keyId, fs.config.DataVersion(), user, 0}, currName}},
			newPath.Path...)

		// get the parent block
		var de *DirEntry
		prevIdx := len(dir.Path) - len(newPath.Path)
		if prevIdx < 0 {
			// root dir, update the MD instead
			de = &(md.data.Dir)
			md.PrevRoot = de.Id
		} else {
			prevDir := Path{dir.TopDir, dir.Path[:prevIdx+1]}
			prevDblock, err := fs.getDirLocked(prevDir, true)
			if err != nil {
				return Path{}, nil, err
			}

			// modify the direntry for name; make one if it doesn't exist
			var ok bool
			if de, ok = prevDblock.Children[currName]; !ok {
				// TODO: deal with large directories and files
				de = &DirEntry{
					IsDir:  isDir,
					IsExec: isExec,
				}
				prevDblock.Children[currName] = de
			}

			currBlock = prevDblock
			currName = prevDir.TailName()
		}

		de.Id = id
		de.Writer = user
		de.KeyId = keyId
		de.Ver = fs.config.DataVersion()

		if newDe == nil {
			if mtime {
				de.Mtime = time.Now().UnixNano()
			}
			if ctime {
				de.Ctime = time.Now().UnixNano()
			}
			newDe = de
		}

		blockContextsToPut = append(blockContextsToPut, de)

		if prevIdx >= 0 && dir.Path[prevIdx].Id == stopAt {
			break
		}
	}

	// now write all the dirblocks to the cache and server
	// TODO: parallelize me
	bcache := fs.config.BlockCache()
	bops := fs.config.BlockOps()
	for i, id := range blockIdsToPut {
		buf := bufsToPut[i]
		ctxt := blockContextsToPut[i]
		if err = bops.Put(id, ctxt, buf); err != nil {
			return Path{}, nil, err
		}
		block := blocksToPut[i]
		if err = bcache.Put(id, block, false); err != nil {
			return Path{}, nil, err
		}
	}

	// TODO: delete old blocks

	// finally, write out the new metadata if we were not supposed to stop
	// early
	if stopAt == zeroId {
		md.data.LastWriter = user
		if err = fs.config.MDOps().Put(dir.TopDir, md); err != nil {
			return Path{}, nil, err
		}
		if err = fs.config.MDCache().Put(dir.TopDir, md); err != nil {
			return Path{}, nil, err
		}
	}

	return newPath, newDe, nil
}

func (fs *KBFSOpsStandard) createEntry(
	dir Path, name string, isDir bool, isExec bool) (
	Path, *DirEntry, error) {
	lock := fs.dirLocks.GetDirLock(dir.TopDir)
	lock.Lock()
	defer lock.Unlock()

	// verify we have permission to write
	if _, err := fs.getMDForWriteLocked(dir); err != nil {
		return Path{}, nil, err
	}

	dblock, err := fs.getDirLocked(dir, true)
	if err != nil {
		return Path{}, nil, err
	}

	// does name already exist?
	if _, ok := dblock.Children[name]; ok {
		return Path{}, nil, &NameExistsError{name}
	}

	// create new data block
	var newBlock Block
	// XXX: for now, put a unique ID in every new block, to make sure it
	// has a unique block ID. This may not be needed once we have encryption.
	if isDir {
		newBlock = &DirBlock{
			CommonBlock: CommonBlock{
				Seed: rand.Int63(),
			},
			Children: make(map[string]*DirEntry),
		}
	} else {
		newBlock = &FileBlock{
			CommonBlock: CommonBlock{
				Seed: rand.Int63(),
			},
		}
	}

	// the parent's mtime/ctime also need to be updated
	var parentDe *DirEntry
	if len(dir.Path) > 1 {
		if pblock, err := fs.getDirLocked(*dir.ParentPath(), true); err == nil {
			parentDe = pblock.Children[dir.TailName()]
		}
	} else {
		// this is the metadata
		if md, err := fs.getMDLocked(dir); err == nil {
			parentDe = &md.data.Dir
		}
	}
	if parentDe != nil {
		parentDe.Mtime = time.Now().UnixNano()
		parentDe.Ctime = time.Now().UnixNano()
	}

	return fs.syncBlockLocked(newBlock, dir, name, isDir, isExec,
		true, true, zeroId)
}

func (fs *KBFSOpsStandard) CreateDir(dir Path, path string) (
	Path, *DirEntry, error) {
	return fs.createEntry(dir, path, true, false)
}

func (fs *KBFSOpsStandard) CreateFile(dir Path, path string, isExec bool) (
	Path, *DirEntry, error) {
	return fs.createEntry(dir, path, false, isExec)
}

func (fs *KBFSOpsStandard) CreateLink(
	dir Path, fromPath string, toPath string) (Path, *DirEntry, error) {
	lock := fs.dirLocks.GetDirLock(dir.TopDir)
	lock.Lock()
	defer lock.Unlock()

	// verify we have permission to write
	if _, err := fs.getMDForWriteLocked(dir); err != nil {
		return Path{}, nil, err
	}

	dblock, err := fs.getDirLocked(dir, true)
	if err != nil {
		return Path{}, nil, err
	}

	// TODO: validate inputs

	// does name already exist?
	if _, ok := dblock.Children[fromPath]; ok {
		return Path{}, nil, &NameExistsError{fromPath}
	}

	// Create a direntry for the link, and then sync
	de := &DirEntry{
		BlockPointer: BlockPointer{
			Size: uint32(len(toPath)),
		},
		IsDir:     false,
		IsExec:    false,
		TotalSize: uint64(len(toPath)),
		IsSym:     true,
		SymPath:   toPath,
		Mtime:     time.Now().UnixNano(),
		Ctime:     time.Now().UnixNano(),
	}

	dblock.Children[fromPath] = de

	newPath, _, err := fs.syncBlockLocked(
		dblock, *dir.ParentPath(), dir.TailName(), true, false,
		true, true, zeroId)
	return newPath, de, err
}

func (fs *KBFSOpsStandard) removeEntryLocked(parentPath Path, name string) (
	Path, error) {
	// verify we have permission to write
	if _, err := fs.getMDForWriteLocked(parentPath); err != nil {
		return Path{}, err
	}

	pblock, err := fs.getDirLocked(parentPath, true)
	if err != nil {
		return Path{}, err
	}

	// make sure the entry exists
	if _, ok := pblock.Children[name]; !ok {
		return Path{}, &NoSuchNameError{name}
	}

	delete(pblock.Children, name)

	// sync the parent directory
	newPath, _, err := fs.syncBlockLocked(
		pblock, *parentPath.ParentPath(), parentPath.TailName(),
		true, false, true, true, zeroId)
	return newPath, err
}

func (fs *KBFSOpsStandard) RemoveDir(dir Path) (Path, error) {
	lock := fs.dirLocks.GetDirLock(dir.TopDir)
	lock.Lock()
	defer lock.Unlock()

	// check for children of the directory, if we can
	dblock, err := fs.getDirLocked(dir, false)
	if err == nil {
		if len(dblock.Children) > 0 {
			return Path{}, &DirNotEmptyError{dir.TailName()}
		} else {
			// TODO: delete the target directory block
		}
	}

	return fs.removeEntryLocked(*dir.ParentPath(), dir.TailName())
}

func (fs *KBFSOpsStandard) RemoveEntry(file Path) (Path, error) {
	lock := fs.dirLocks.GetDirLock(file.TopDir)
	lock.Lock()
	defer lock.Unlock()

	return fs.removeEntryLocked(*file.ParentPath(), file.TailName())
}

func (fs *KBFSOpsStandard) Rename(
	oldParent Path, oldName string, newParent Path, newName string) (
	Path, Path, error) {
	// only works for paths within the same topdir
	if (oldParent.TopDir != newParent.TopDir) ||
		(oldParent.Path[0].Id != newParent.Path[0].Id) {
		return Path{}, Path{}, &RenameAcrossDirsError{}
	}

	lock := fs.dirLocks.GetDirLock(oldParent.TopDir)
	lock.Lock()
	defer lock.Unlock()

	// verify we have permission to write
	if _, err := fs.getMDForWriteLocked(oldParent); err != nil {
		return Path{}, Path{}, err
	}

	// look up in the old path
	oldPBlock, err := fs.getDirLocked(oldParent, true)
	if err != nil {
		return Path{}, Path{}, err
	}
	// does name exist?
	if _, ok := oldPBlock.Children[oldName]; !ok {
		return Path{}, Path{}, &NoSuchNameError{oldName}
	}

	// look up in the old path
	newPBlock, err := fs.getDirLocked(newParent, true)
	if err != nil {
		return Path{}, Path{}, err
	}
	// does name exist?
	if _, ok := newPBlock.Children[newName]; ok {
		// TODO: delete the old block pointed to by this direntry
	}

	newPBlock.Children[newName] = oldPBlock.Children[oldName]
	// only the ctime changes
	newPBlock.Children[newName].Ctime = time.Now().UnixNano()
	delete(oldPBlock.Children, oldName)

	// find the common ancestor
	var i int
	found := false
	// the root block will always be there same, so start at number 1
	for i = 1; i < len(oldParent.Path) && i < len(newParent.Path); i++ {
		if oldParent.Path[i].Id != newParent.Path[i].Id {
			found = true
			i--
			break
		}
	}
	if !found {
		// if we couldn't find one, then the common ancestor is the
		// last node in the shorter path
		if len(oldParent.Path) < len(newParent.Path) {
			i = len(oldParent.Path) - 1
		} else {
			i = len(newParent.Path) - 1
		}
	}
	commonAncestor := oldParent.Path[i].Id

	newOldPath := Path{TopDir: oldParent.TopDir}
	if commonAncestor != oldParent.TailPointer().Id {
		// TODO: optimize by pushing blocks from both paths in parallel
		newOldPath, _, err = fs.syncBlockLocked(
			oldPBlock, *oldParent.ParentPath(), oldParent.TailName(),
			true, false, true, true, commonAncestor)
		if err != nil {
			return Path{}, Path{}, err
		}
	} else {
		// still need to update the old parent's times
		if b, err := fs.getDirLocked(
			*oldParent.ParentPath(), true); err == nil {
			if de, ok := b.Children[oldParent.TailName()]; ok {
				de.Ctime = time.Now().UnixNano()
				de.Mtime = time.Now().UnixNano()
			}
		}
	}

	newNewPath, _, err := fs.syncBlockLocked(
		newPBlock, *newParent.ParentPath(), newParent.TailName(),
		true, false, true, true, zeroId)
	if err != nil {
		return Path{}, Path{}, err
	}

	// newOldPath is really just a prefix now.  A copy is necessary as an
	// append could cause the new path to contain nodes from the old path.
	newOldPath.Path = append(make([]*PathNode, i+1, i+1), newOldPath.Path...)
	copy(newOldPath.Path[:i+1], newNewPath.Path[:i+1])

	return newOldPath, newNewPath, nil
}

func (fs *KBFSOpsStandard) getFileBlockAtOffset(
	file Path, topBlock *FileBlock, off int64, asWrite bool) (
	id BlockId, block *FileBlock, more bool, startOff int64, err error) {
	// find the block matching the offset, if it exists
	id = file.TailPointer().Id
	block = topBlock
	more = false
	startOff = 0
	// search until it's not an indirect block
	for block.IsInd {
		nextIndex := len(block.IPtrs) - 1
		for i, ptr := range block.IPtrs {
			if ptr.Off == off {
				// small optimization to avoid iterating past the right ptr
				nextIndex = i
				break
			} else if ptr.Off > off {
				// i can never be 0, because the first ptr always has
				// an offset at the beginning of the range
				nextIndex = i - 1
				break
			}
		}
		nextPtr := block.IPtrs[nextIndex]
		startOff = nextPtr.Off
		newPath := file
		// there is more to read if we ever took a path through a
		// ptr that wasn't the final ptr in its respectve list
		more = more || (nextIndex != len(block.IPtrs)-1)
		id = nextPtr.Id
		newPath.Path = append(newPath.Path, &PathNode{
			nextPtr.BlockPointer, file.TailName(),
		})
		if block, err = fs.getFileLocked(newPath, asWrite); err != nil {
			return
		}
	}

	return
}

func (fs *KBFSOpsStandard) Read(file Path, dest []byte, off int64) (
	int64, error) {
	lock := fs.dirLocks.GetDirLock(file.TopDir)
	lock.RLock()
	defer lock.RUnlock()

	// getFileLocked already checks read permissions
	fblock, err := fs.getFileLocked(file, false)
	if err != nil {
		return 0, err
	}

	nRead := int64(0)
	n := int64(len(dest))

	for nRead < n {
		nextByte := nRead + off
		toRead := n - nRead
		_, block, _, startOff, err :=
			fs.getFileBlockAtOffset(file, fblock, nextByte, false)
		if err != nil {
			return 0, err
		}
		blockLen := int64(len(block.Contents))
		lastByteInBlock := startOff + blockLen

		if nextByte >= lastByteInBlock {
			return nRead, nil
		} else if toRead > lastByteInBlock-nextByte {
			toRead = lastByteInBlock - nextByte
		}

		firstByteToRead := nextByte - startOff
		copy(dest[nRead:nRead+toRead],
			block.Contents[firstByteToRead:toRead+firstByteToRead])
		nRead += toRead
	}

	return n, nil
}

func (fs *KBFSOpsStandard) getEntryLocked(file Path) (
	*DirBlock, *DirEntry, error) {
	parentPath := file.ParentPath()
	dblock, err := fs.getDirLocked(*parentPath, true)
	if err != nil {
		return nil, nil, err
	}

	// make sure it exists
	name := file.TailName()
	if de, ok := dblock.Children[name]; !ok {
		return nil, nil, &NoSuchNameError{name}
	} else {
		return dblock, de, err
	}
}

func (fs *KBFSOpsStandard) newRightBlockLocked(
	id BlockId, pblock *FileBlock, off int64, md *RootMetadata) error {
	newRId := RandBlockId()
	user, err := fs.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return err
	}
	rblock := &FileBlock{
		CommonBlock: CommonBlock{
			Seed: rand.Int63(),
		},
	}
	if err :=
		fs.config.BlockCache().Put(newRId, rblock, true); err != nil {
		return err
	}

	pblock.IPtrs = append(pblock.IPtrs, IndirectFilePtr{
		BlockPointer{newRId, md.LatestKeyId(), fs.config.DataVersion(), user, 0},
		off})
	if err := fs.config.BlockCache().Put(id, pblock, true); err != nil {
		return err
	}
	return nil
}

func (fs *KBFSOpsStandard) writeDataLocked(
	file Path, data []byte, off int64) error {
	// verify we have permission to write
	md, err := fs.getMDForWriteLocked(file)
	if err != nil {
		return err
	}

	fblock, err := fs.getFileLocked(file, true)
	if err != nil {
		return err
	}

	bcache := fs.config.BlockCache()
	bsplit := fs.config.BlockSplitter()
	n := int64(len(data))
	nCopied := int64(0)
	user, err := fs.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return err
	}

	for nCopied < n {
		id, block, more, startOff, err :=
			fs.getFileBlockAtOffset(file, fblock, off+nCopied, true)
		if err != nil {
			return err
		}

		oldLen := len(block.Contents)
		nCopied += bsplit.CopyUntilSplit(block, !more, data[nCopied:],
			off+nCopied-startOff)

		// the block splitter could only have copied to the end of the
		// existing block (or appended to the end of the final block), so
		// we shouldn't ever hit this case:
		if more && oldLen < len(block.Contents) {
			return &BadSplitError{}
		}

		// TODO: support multiple levels of indirection.  Right now the
		// code only does one but it should be straightforward to
		// generalize, just annoying

		// if we need another block but there are no more, then make one
		if nCopied < n && !more {
			// If the block doesn't already have a parent block, make one.
			if id == file.TailPointer().Id {
				// pick a new id for this block, and use this block's ID for
				// the parent
				newId := RandBlockId()
				fblock = &FileBlock{
					CommonBlock: CommonBlock{
						IsInd: true,
						Seed:  rand.Int63(),
					},
					IPtrs: []IndirectFilePtr{
						IndirectFilePtr{
							BlockPointer{newId, md.LatestKeyId(),
								fs.config.DataVersion(), user, 0}, 0},
					},
				}
				if err := bcache.Put(
					file.TailPointer().Id, fblock, true); err != nil {
					return err
				}
				id = newId
			}

			// Make a new right block and update the parent's
			// indirect block list
			if err := fs.newRightBlockLocked(file.TailPointer().Id, fblock,
				startOff+int64(len(block.Contents)), md); err != nil {
				return err
			}
		}

		if dblock, de, err := fs.getEntryLocked(file); err == nil {
			if oldLen != len(block.Contents) || de.Writer != user {
				// update the file info
				de.TotalSize += uint64(len(block.Contents) - oldLen)
				de.Writer = user
				// the copy will be dirty, so put it in the cache
				bcache.Put(
					file.ParentPath().TailPointer().Id, dblock, true)
			}
		} else {
			return err
		}

		// keep the old block ID while it's dirty
		if err := bcache.Put(id, block, true); err != nil {
			return err
		}
	}

	if fblock.IsInd && !bcache.IsDirty(file.TailPointer().Id) {
		// always make the parent block dirty, so we will sync its
		// indirect blocks
		if err := bcache.Put(
			file.TailPointer().Id, fblock, true); err != nil {
			return err
		}
	}

	return nil
}

func (fs *KBFSOpsStandard) Write(file Path, data []byte, off int64) error {
	// Even though writing doesn't change the directory, we still take the
	// write lock since it is changing the contents of file blocks
	lock := fs.dirLocks.GetDirLock(file.TopDir)
	lock.Lock()
	defer lock.Unlock()

	return fs.writeDataLocked(file, data, off)
}

func (fs *KBFSOpsStandard) Truncate(file Path, size uint64) error {
	lock := fs.dirLocks.GetDirLock(file.TopDir)
	lock.Lock()
	defer lock.Unlock()

	// verify we have permission to write
	if _, err := fs.getMDForWriteLocked(file); err != nil {
		return err
	}

	fblock, err := fs.getFileLocked(file, true)
	if err != nil {
		return err
	}

	// find the block where the file should now end
	iSize := int64(size) // TODO: deal with overflow
	id, block, more, startOff, err :=
		fs.getFileBlockAtOffset(file, fblock, iSize, true)

	currLen := int64(startOff) + int64(len(block.Contents))
	if currLen < iSize {
		// if we need to extend the file, let's just do a write
		moreNeeded := iSize - currLen
		return fs.writeDataLocked(
			file, make([]byte, moreNeeded, moreNeeded), currLen)
	} else if currLen == iSize {
		// same size!
		return nil
	}

	user, err := fs.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return err
	}
	// otherwise, we need to delete some data (and possibly entire blocks)
	block.Contents = append([]byte(nil), block.Contents[:iSize-startOff]...)
	if more {
		// the parent block must be indirect
		indIndex := 0
		for i, ptr := range fblock.IPtrs {
			if ptr.Id == id {
				indIndex = i
				break
			}
		}
		// TODO: delete the blocks we're truncating off
		// TODO: if indIndex == 0, we can remove the level of indirection
		fblock.IPtrs = fblock.IPtrs[:indIndex+1]
		// always make the parent block dirty, so we will sync it
		if err := fs.config.BlockCache().Put(
			file.TailPointer().Id, fblock, true); err != nil {
			return err
		}
	}

	// update the local entry size
	if dblock, de, err := fs.getEntryLocked(file); err == nil {
		de.TotalSize = size
		de.Writer = user
		// the copy will be dirty, so put it in the cache
		fs.config.BlockCache().Put(
			file.ParentPath().TailPointer().Id, dblock, true)
	} else {
		return err
	}

	// keep the old block ID while it's dirty
	return fs.config.BlockCache().Put(id, block, true)
}

func (fs *KBFSOpsStandard) SetEx(file Path, ex bool) (Path, error) {
	lock := fs.dirLocks.GetDirLock(file.TopDir)
	lock.Lock()
	defer lock.Unlock()

	// verify we have permission to write
	if _, err := fs.getMDForWriteLocked(file); err != nil {
		return Path{}, err
	}

	dblock, de, err := fs.getEntryLocked(file)
	if err != nil {
		return Path{}, err
	}

	de.IsExec = ex
	de.Ctime = time.Now().UnixNano()
	parentPath := file.ParentPath()
	newParentPath, _, err := fs.syncBlockLocked(
		dblock, *parentPath.ParentPath(), parentPath.TailName(),
		true, false, false, false, zeroId)
	newPath := Path{file.TopDir,
		append(newParentPath.Path, file.Path[len(file.Path)-1])}
	return newPath, err
}

func (fs *KBFSOpsStandard) SetMtime(file Path, mtime *time.Time) (Path, error) {
	if mtime == nil {
		// Can happen on some OSes (e.g. OSX) when trying to set the atime only
		return file, nil
	}

	lock := fs.dirLocks.GetDirLock(file.TopDir)
	lock.Lock()
	defer lock.Unlock()

	// verify we have permission to write
	if _, err := fs.getMDForWriteLocked(file); err != nil {
		return Path{}, err
	}

	dblock, de, err := fs.getEntryLocked(file)
	if err != nil {
		return Path{}, err
	}

	de.Mtime = mtime.UnixNano()
	// setting the mtime counts as changing the file MD, so must set ctime too
	de.Ctime = time.Now().UnixNano()
	parentPath := file.ParentPath()
	newParentPath, _, err := fs.syncBlockLocked(
		dblock, *parentPath.ParentPath(), parentPath.TailName(),
		true, false, false, false, zeroId)
	newPath := Path{file.TopDir,
		append(newParentPath.Path, file.Path[len(file.Path)-1])}
	return newPath, err
}

func (fs *KBFSOpsStandard) Sync(file Path) (Path, error) {
	lock := fs.dirLocks.GetDirLock(file.TopDir)
	lock.Lock()
	defer lock.Unlock()

	// if the cache for this file isn't dirty, we're done
	bcache := fs.config.BlockCache()
	id := file.TailPointer().Id
	if !bcache.IsDirty(id) {
		return file, nil
	}

	// verify we have permission to write
	md, err := fs.getMDForWriteLocked(file)
	if err != nil {
		return Path{}, err
	}

	// update the parent directories, and write all the new blocks out
	// to disk
	fblock, err := fs.getFileLocked(file, true)
	if err != nil {
		return Path{}, err
	}

	user, err := fs.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return Path{}, err
	}

	// if this is an indirect block:
	//   1) check if each dirty block is split at the right place.
	//   2) if it needs fewer bytes, prepend the extra bytes to the next
	//      block (making a new one if it doesn't exist), and the next block
	//      gets marked dirty
	//   3) if it needs more bytes, then use copyUntilSplit() to fetch bytes
	//      from the next block (if there is one), remove the copied bytes
	//      from the next block and mark it dirty
	//   4) Then go through once more, and ready and finalize each
	//      dirty block, updating its ID in the indirect pointer list
	bsplit := fs.config.BlockSplitter()
	if fblock.IsInd {
		for i := 0; i < len(fblock.IPtrs); i++ {
			ptr := fblock.IPtrs[i]
			if bcache.IsDirty(ptr.Id) {
				_, block, more, _, err :=
					fs.getFileBlockAtOffset(file, fblock, ptr.Off, true)
				if err != nil {
					return Path{}, err
				}

				splitAt := bsplit.CheckSplit(block)
				switch {
				case splitAt == 0:
					continue
				case splitAt > 0:
					endOfBlock := ptr.Off + int64(len(block.Contents))
					extraBytes := block.Contents[splitAt:]
					block.Contents = block.Contents[:splitAt]
					// put the extra bytes in front of the next block
					if !more {
						// need to make a new block
						if err := fs.newRightBlockLocked(
							file.TailPointer().Id, fblock,
							endOfBlock, md); err != nil {
							return Path{}, err
						}
					}
					rId, rblock, _, _, err :=
						fs.getFileBlockAtOffset(file, fblock, endOfBlock, true)
					if err != nil {
						return Path{}, err
					}
					rblock.Contents = append(extraBytes, rblock.Contents...)
					if err := fs.config.BlockCache().Put(
						rId, rblock, true); err != nil {
						return Path{}, err
					}
					fblock.IPtrs[i+1].Off = ptr.Off + int64(len(block.Contents))
				case splitAt < 0:
					if !more {
						// end of the line
						continue
					}

					endOfBlock := ptr.Off + int64(len(block.Contents))
					rId, rblock, _, _, err :=
						fs.getFileBlockAtOffset(file, fblock, endOfBlock, true)
					if err != nil {
						return Path{}, err
					}
					// copy some of that block's data into this block
					nCopied := bsplit.CopyUntilSplit(block, false,
						rblock.Contents, int64(len(block.Contents)))
					rblock.Contents = rblock.Contents[nCopied:]
					if len(rblock.Contents) > 0 {
						if err := fs.config.BlockCache().Put(
							rId, rblock, true); err != nil {
							return Path{}, err
						}
						fblock.IPtrs[i+1].Off =
							ptr.Off + int64(len(block.Contents))
					} else {
						// TODO: delete the block, and if we're down to just
						// one indirect block, remove the layer of indirection
						fblock.IPtrs =
							append(fblock.IPtrs[:i+1], fblock.IPtrs[i+2:]...)
					}
				}
			}
		}

		encryptKey, err := fs.config.KeyManager().GetSecretKey(file, md)
		if err != nil {
			return Path{}, err
		}
		bops := fs.config.BlockOps()
		kops := fs.config.KeyOps()
		crypto := fs.config.Crypto()
		kcache := fs.config.KeyCache()
		for i, ptr := range fblock.IPtrs {
			// TODO: parallelize these?
			if bcache.IsDirty(ptr.Id) {
				_, block, _, _, err :=
					fs.getFileBlockAtOffset(file, fblock, ptr.Off, true)
				if err != nil {
					return Path{}, err
				}

				// new key for the block
				blockServKey := crypto.GenRandomSecretKey()
				blockKey, err := crypto.XOR(blockServKey, encryptKey)
				if err != nil {
					return Path{}, err
				}

				// ready/finalize/put the block
				id, buf, err := bops.Ready(block, blockKey)
				if err != nil {
					return Path{}, err
				}
				bcache.Finalize(ptr.Id, id)
				fblock.IPtrs[i].Id = id
				fblock.IPtrs[i].Writer = user
				if err := bops.Put(id, &fblock.IPtrs[i], buf); err != nil {
					return Path{}, err
				}

				if err := kops.PutBlockKey(id, blockServKey); err != nil {
					return Path{}, err
				} else if err := kcache.PutBlockKey(id, blockKey); err != nil {
					return Path{}, err
				}
			}
		}
	}

	parentPath := file.ParentPath()
	newPath, _, err :=
		fs.syncBlockLocked(fblock, *parentPath, file.TailName(),
			false, false, true, true, zeroId)
	if err != nil {
		return Path{}, err
	}
	bcache.Finalize(id, newPath.TailPointer().Id)

	// the parent block was probably also dirty, finalize that one too
	if bcache.IsDirty(parentPath.TailPointer().Id) {
		bcache.Finalize(parentPath.TailPointer().Id,
			newPath.ParentPath().TailPointer().Id)
	}

	return newPath, nil
}
