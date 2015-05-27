package libkbfs

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/keybase/kbfs/util"
)

type reqType int

const (
	read  reqType = iota // A read request
	write         = iota // A write request
)

// KBFSOpsStandard implements the KBFS interface, and is go-routine
// safe by using per-top-level-directory read-write locks
type KBFSOpsStandard struct {
	config          Config
	dirRWChans      *DirRWSchedulers
	globalStateLock sync.RWMutex   // protects heads and observers
	heads           map[DirId]MDId // temporary until state machine is ready
	observers       map[DirId][]Observer
}

func NewKBFSOpsStandard(config Config) *KBFSOpsStandard {
	return &KBFSOpsStandard{
		config:     config,
		dirRWChans: NewDirRWSchedulers(config),
		heads:      make(map[DirId]MDId),
		observers:  make(map[DirId][]Observer),
	}
}

func (fs *KBFSOpsStandard) Shutdown() {
	fs.dirRWChans.Shutdown()
}

func (fs *KBFSOpsStandard) GetFavDirs() ([]DirId, error) {
	mdops := fs.config.MDOps()
	return mdops.GetFavorites()
}

func (fs *KBFSOpsStandard) getMDInChannel(dir Path, rtype reqType) (
	*RootMetadata, error) {
	ver := fs.config.DataVersion()
	if len(dir.Path) > 0 {
		ver = dir.TailPointer().GetVer()
	}
	if ver > fs.config.DataVersion() {
		return nil, &NewVersionError{dir, ver}
	}

	mdcache := fs.config.MDCache()
	fs.globalStateLock.RLock()
	if mdId, ok := fs.heads[dir.TopDir]; ok {
		if md, err := mdcache.Get(mdId); err == nil {
			fs.globalStateLock.RUnlock()
			return md, nil
		} else if _, ok = err.(*NoSuchMDError); !ok {
			// If we get an unexpected error, then completely bail
			fs.globalStateLock.RUnlock()
			return nil, err
		}
	}
	fs.globalStateLock.RUnlock()

	// if we're in read mode, we can't safely fetch the new MD without
	// causing races, so bail
	if rtype == read {
		return nil, &WriteNeededInReadRequest{}
	}

	// not in cache, fetch from server and add to cache
	mdops := fs.config.MDOps()
	md, err := mdops.Get(dir.TopDir)
	if err != nil {
		return nil, err
	}

	if md.data.Dir.Type != Dir {
		err = fs.initMDInChannel(md)
	} else {
		// if already initialized, store directly in cache
		mdId, err := md.MetadataId(fs.config)
		if err != nil {
			return nil, err
		}

		fs.globalStateLock.Lock()
		defer fs.globalStateLock.Unlock()
		fs.heads[dir.TopDir] = mdId
		err = mdcache.Put(mdId, md)
	}

	return md, err
}

func (fs *KBFSOpsStandard) getMDForReadInChannel(dir Path, rtype reqType) (
	*RootMetadata, error) {
	md, err := fs.getMDInChannel(dir, rtype)
	if err != nil {
		return nil, err
	}

	user, err := fs.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return nil, err
	}
	if !md.GetDirHandle().IsReader(user) {
		return nil, NewReadAccessError(fs.config, md.GetDirHandle(), user)
	}
	return md, nil
}

func (fs *KBFSOpsStandard) getMDForWriteInChannel(dir Path) (
	*RootMetadata, error) {
	md, err := fs.getMDInChannel(dir, write)
	if err != nil {
		return nil, err
	}

	user, err := fs.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return nil, err
	}
	if !md.GetDirHandle().IsWriter(user) {
		return nil, NewWriteAccessError(fs.config, md.GetDirHandle(), user)
	}

	// Make a copy of the MD for changing.  The caller must pass this
	// into syncBlockInChannel or save it in the cache, or the changes
	// will be lost.
	newMd := md.DeepCopy()
	return &newMd, nil
}

func (fs *KBFSOpsStandard) initMDInChannel(md *RootMetadata) error {
	// create a dblock since one doesn't exist yet
	user, err := fs.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return err
	}

	if !md.GetDirHandle().IsWriter(user) {
		return NewWriteAccessError(fs.config, md.GetDirHandle(), user)
	}

	newDblock := &DirBlock{
		CommonBlock: CommonBlock{
			Seed: rand.Int63(),
		},
		Children: make(map[string]DirEntry),
	}

	// create a new set of keys for this metadata
	if err := fs.config.KeyManager().Rekey(md); err != nil {
		return err
	}

	path := Path{md.Id, []PathNode{PathNode{
		BlockPointer{BlockId{}, 0, fs.config.DataVersion(), user, 0},
		md.GetDirHandle().ToString(fs.config),
	}}}
	tlfCryptKey, err := fs.config.KeyManager().GetTLFCryptKey(path, md)
	if err != nil {
		return err
	}
	id, plainSize, buf, err := fs.readyBlock(newDblock, tlfCryptKey)
	if err != nil {
		return err
	}

	md.data.Dir = DirEntry{
		BlockPointer: BlockPointer{
			Id:        id,
			KeyVer:    0,
			Ver:       fs.config.DataVersion(),
			Writer:    user,
			QuotaSize: uint32(len(buf)),
		},
		Type:  Dir,
		Size:  uint64(plainSize),
		Mtime: time.Now().UnixNano(),
		Ctime: time.Now().UnixNano(),
	}
	md.AddRefBlock(path, md.data.Dir.BlockPointer)
	md.UnrefBytes = 0

	// make sure we're a writer before putting any blocks
	if !md.GetDirHandle().IsWriter(user) {
		return NewWriteAccessError(fs.config, md.GetDirHandle(), user)
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
	if mdId, err := md.MetadataId(fs.config); err != nil {
		return err
	} else if err = fs.config.MDCache().Put(mdId, md); err != nil {
		return err
	} else {
		fs.globalStateLock.Lock()
		defer fs.globalStateLock.Unlock()
		if curMdId, ok := fs.heads[md.Id]; ok {
			return fmt.Errorf(
				"%v: Unexpected MD ID during new MD initialization: %v",
				md.Id, curMdId)
		}
		fs.heads[md.Id] = mdId
	}
	return nil
}

type errChan chan error

func (fs *KBFSOpsStandard) getChans(id DirId) (
	rwchan util.RWScheduler, errchan errChan) {
	rwchan = fs.dirRWChans.GetDirChan(id)
	// Use this channel to receive the errors for each
	// read/write request.  In the cases where other return values are
	// needed, the closure can fill in the named return values of the
	// calling method directly.  By the time a receive on this channel
	// returns, those writes are guaranteed to be visible.  See
	// https://golang.org/ref/mem#tmp_7.
	errchan = make(errChan)
	return
}

func (fs *KBFSOpsStandard) GetRootMDForHandle(dirHandle *DirHandle) (
	*RootMetadata, error) {
	// Do GetAtHandle() unlocked -- no cache lookups, should be fine
	mdops := fs.config.MDOps()
	if md, err := mdops.GetAtHandle(dirHandle); err == nil {
		// Type defaults to File, so if it was set to Dir then MD
		// already exists
		if md.data.Dir.Type != Dir {
			rwchan, errchan := fs.getChans(md.Id)
			rwchan.QueueWriteReq(func() { errchan <- fs.initMDInChannel(md) })
			err = <-errchan
		}
		return md, err
	} else {
		return nil, err
	}
}

// execReadInChannel first queues the passed-in method as a read
// request.  If it fails with a WriteNeededInReadRequest error, it
// re-executes the method as a write request.  The passed-in method
// must note whether or not this is a write call.
func (fs *KBFSOpsStandard) execReadInChannel(
	dir DirId, f func(reqType) error) error {
	rwchan, errchan := fs.getChans(dir)
	rwchan.QueueReadReq(func() { errchan <- f(read) })
	err := <-errchan

	// Redo in a write request if needed
	if _, ok := err.(*WriteNeededInReadRequest); ok {
		rwchan.QueueWriteReq(func() { errchan <- f(write) })
		err = <-errchan
	}
	return err
}

func (fs *KBFSOpsStandard) GetRootMD(dir DirId) (md *RootMetadata, err error) {
	// don't check read permissions here -- anyone should be able to read
	// the MD to determine whether there's a public subdir or not
	fs.execReadInChannel(dir, func(rtype reqType) error {
		md, err = fs.getMDInChannel(Path{TopDir: dir}, rtype)
		return err
	})
	return
}

type makeNewBlock func() Block

func (fs *KBFSOpsStandard) getBlockInChannel(
	dir Path, id BlockId, newBlock makeNewBlock, rtype reqType) (
	Block, error) {
	ver := dir.TailPointer().GetVer()
	if ver > fs.config.DataVersion() {
		return nil, &NewVersionError{dir, ver}
	}

	bcache := fs.config.BlockCache()
	if block, err := bcache.Get(id); err == nil {
		return block, nil
	}

	// fetch the block, and add to cache
	block := newBlock()
	bops := fs.config.BlockOps()
	if md, err := fs.getMDInChannel(dir, rtype); err != nil {
		return nil, err
	} else if k, err :=
		fs.config.KeyManager().GetBlockCryptKey(dir, id, md); err != nil {
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

func (fs *KBFSOpsStandard) getDirInChannel(dir Path, rtype reqType) (
	*DirBlock, error) {
	if _, err := fs.getMDForReadInChannel(dir, rtype); err != nil {
		return nil, err
	}

	// get the directory for the last element in the path
	id := dir.TailPointer().Id
	if block, err := fs.getBlockInChannel(
		dir, id, NewDirBlock, rtype); err == nil {
		if dblock, ok := block.(*DirBlock); ok {
			if rtype == write && !fs.config.BlockCache().IsDirty(id) {
				// copy the block if it's for writing
				//
				// TODO: We should make a deep copy,
				// i.e. copy the Children and IPtr
				// slices.
				dblockCopy := NewDirBlock().(*DirBlock)
				*dblockCopy = *dblock
				dblock = dblockCopy
			}
			return dblock, nil
		} else {
			return nil, &NotDirError{dir}
		}
	} else {
		return nil, err
	}
}

func (fs *KBFSOpsStandard) getFileInChannel(dir Path, rtype reqType) (
	*FileBlock, error) {
	if _, err := fs.getMDForReadInChannel(dir, rtype); err != nil {
		return nil, err
	}

	// get the directory for the last element in the path
	id := dir.TailPointer().Id
	if block, err := fs.getBlockInChannel(
		dir, id, NewFileBlock, rtype); err == nil {
		if fblock, ok := block.(*FileBlock); ok {
			if rtype == write && !fs.config.BlockCache().IsDirty(id) {
				// copy the block if it's for writing
				fblockCopy := NewFileBlock().(*FileBlock)
				*fblockCopy = *fblock
				fblock = fblockCopy
			}
			return fblock, nil
		} else {
			return nil, &NotFileError{dir}
		}
	} else {
		return nil, err
	}
}

func (fs *KBFSOpsStandard) GetDir(dir Path) (block *DirBlock, err error) {
	fs.execReadInChannel(dir.TopDir, func(rtype reqType) error {
		block, err = fs.getDirInChannel(dir, rtype)
		return err
	})
	return
}

var zeroId BlockId

// blockPutState is an internal structure to track data when putting blocks
type blockPutState struct {
	ids      []BlockId
	blocks   []Block
	contexts []BlockContext
	bufs     [][]byte
}

func newBlockPutState(length int) *blockPutState {
	bps := &blockPutState{}
	bps.ids = make([]BlockId, 0, length)
	bps.blocks = make([]Block, 0, length)
	bps.contexts = make([]BlockContext, 0, length)
	bps.bufs = make([][]byte, 0, length)
	return bps
}

func (bps *blockPutState) addBlock(id BlockId, ptr BlockPointer,
	block Block, buf []byte) {
	bps.ids = append(bps.ids, id)
	bps.contexts = append(bps.contexts, ptr)
	bps.blocks = append(bps.blocks, block)
	bps.bufs = append(bps.bufs, buf)
}

func (fs *KBFSOpsStandard) readyBlock(block Block, tlfCryptKey TLFCryptKey) (
	id BlockId, plainSize int, buf []byte, err error) {
	// new key for the block
	crypto := fs.config.Crypto()
	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	if err != nil {
		return
	}

	blockKey, err := crypto.UnmaskBlockCryptKey(serverHalf, tlfCryptKey)
	if err != nil {
		return
	}

	id, plainSize, buf, err = fs.config.BlockOps().Ready(block, blockKey)
	if err != nil {
		return
	}

	// store the keys
	if err = fs.config.KeyOps().PutBlockCryptKeyServerHalf(id, serverHalf); err != nil {
		return
	} else if err = fs.config.KeyCache().PutBlockCryptKey(id, blockKey); err != nil {
		return
	}

	return
}

func (fs *KBFSOpsStandard) readyBlockMultiple(currBlock Block, bps *blockPutState,
	md *RootMetadata, tlfCryptKey TLFCryptKey, user keybase1.UID) (
	plainSize int, blockPtr BlockPointer, err error) {
	id, plainSize, buf, err := fs.readyBlock(currBlock, tlfCryptKey)
	if err != nil {
		return
	}

	blockPtr = BlockPointer{id, md.LatestKeyVersion(), fs.config.DataVersion(),
		user, uint32(len(buf))}
	bps.addBlock(id, blockPtr, currBlock, buf)

	return
}

func (fs *KBFSOpsStandard) unembedBlockChanges(bps *blockPutState,
	md *RootMetadata, changes *BlockChanges, tlfCryptKey TLFCryptKey,
	user keybase1.UID) (err error) {
	buf, err := fs.config.Codec().Encode(changes.Changes)
	if err != nil {
		return
	}
	block := NewFileBlock().(*FileBlock)
	block.Contents = buf
	var blockPtr BlockPointer
	_, blockPtr, err = fs.readyBlockMultiple(block, bps, md, tlfCryptKey, user)
	if err != nil {
		return
	}
	changes.Pointer = blockPtr
	changes.Changes = nil
	md.RefBytes += uint64(blockPtr.QuotaSize)
	return
}

func (fs *KBFSOpsStandard) saveMdToCache(md *RootMetadata) error {
	// TODO: If this is a temporary MD being saved by write/truncate,
	// the next write/truncate operation will make another copy
	// for writing, which isn't necessary.
	mdId, err := md.MetadataId(fs.config)
	if err != nil {
		return err
	}

	fs.globalStateLock.Lock()
	defer fs.globalStateLock.Unlock()
	if oldMdId, ok := fs.heads[md.Id]; ok && oldMdId == mdId {
		// only save this new MD if the MDId has changed
		return nil
	} else if err = fs.config.MDCache().Put(mdId, md); err != nil {
		return err
	} else {
		fs.heads[md.Id] = mdId
	}
	return nil
}

// TODO: deal with multiple nodes for indirect blocks
//
// entryType must not by Sym.
func (fs *KBFSOpsStandard) syncBlockInChannel(md *RootMetadata,
	newBlock Block, dir Path, name string, entryType EntryType,
	mtime bool, ctime bool, stopAt BlockId) (Path, DirEntry, error) {
	user, err := fs.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return Path{}, DirEntry{}, err
	}
	tlfCryptKey, err := fs.config.KeyManager().GetTLFCryptKey(dir, md)
	if err != nil {
		return Path{}, DirEntry{}, err
	}

	// now ready each dblock and write the DirEntry for the next one
	// in the path
	currBlock := newBlock
	currName := name
	newPath := Path{dir.TopDir, make([]PathNode, 0, len(dir.Path))}
	bps := newBlockPutState(len(dir.Path))
	refPath := *dir.ChildPathNoPtr(name)
	var newDe DirEntry
	for len(newPath.Path) < len(dir.Path)+1 {
		plainSize, blockPtr, err :=
			fs.readyBlockMultiple(currBlock, bps, md, tlfCryptKey, user)
		if err != nil {
			return Path{}, DirEntry{}, err
		}
		// prepend to path and setup next one
		newPath.Path = append([]PathNode{PathNode{blockPtr, currName}},
			newPath.Path...)

		// get the parent block
		prevIdx := len(dir.Path) - len(newPath.Path)
		var prevDblock *DirBlock
		var de DirEntry
		var nextName string
		if prevIdx < 0 {
			// root dir, update the MD instead
			de = md.data.Dir
			fs.globalStateLock.RLock()
			md.PrevRoot = fs.heads[dir.TopDir]
			fs.globalStateLock.RUnlock()
		} else {
			prevDir := Path{dir.TopDir, dir.Path[:prevIdx+1]}
			prevDblock, err = fs.getDirInChannel(prevDir, write)
			if err != nil {
				return Path{}, DirEntry{}, err
			}

			// modify the direntry for currName; make one
			// if it doesn't exist (which should only
			// happen the first time around).
			//
			// TODO: Pull the creation out of here and
			// into createEntryInChannel().
			var ok bool
			if de, ok = prevDblock.Children[currName]; !ok {
				// If this isn't the first time
				// around, we have an error.
				if len(newPath.Path) > 1 {
					return Path{}, DirEntry{}, &NoSuchNameError{currName}
				}

				// If this is a file, the size should
				// be 0. (TODO: Ensure this.) If this
				// is a directory, the size will be
				// filled in below.
				de = DirEntry{
					Type:  entryType,
					Mtime: time.Now().UnixNano(),
					Ctime: time.Now().UnixNano(),
					Size:  0,
				}
			}

			currBlock = prevDblock
			nextName = prevDir.TailName()
		}

		if de.Type == Dir {
			// TODO: When we use indirect dir blocks,
			// we'll have to calculate the size some other
			// way.
			de.Size = uint64(plainSize)
		}

		if prevIdx < 0 {
			md.AddUnrefBlock(refPath, md.data.Dir.BlockPointer)
		} else {
			md.AddUnrefBlock(refPath,
				prevDblock.Children[currName].BlockPointer)
		}
		md.AddRefBlock(refPath, blockPtr)
		if len(refPath.Path) > 1 {
			refPath = *refPath.ParentPath()
		}
		de.BlockPointer = blockPtr

		if !newDe.IsInitialized() {
			now := time.Now().UnixNano()
			if mtime {
				de.Mtime = now
			}
			if ctime {
				de.Ctime = now
			}
			newDe = de
		}

		if prevIdx < 0 {
			md.data.Dir = de
		} else {
			prevDblock.Children[currName] = de
		}
		currName = nextName

		if prevIdx >= 0 && dir.Path[prevIdx].Id == stopAt {
			break
		}
	}

	// do the block changes need their own blocks?
	bsplit := fs.config.BlockSplitter()
	if !bsplit.ShouldEmbedBlockChanges(&md.data.RefBlocks) {
		err = fs.unembedBlockChanges(bps, md, &md.data.RefBlocks,
			tlfCryptKey, user)
		if err != nil {
			return Path{}, DirEntry{}, err
		}
	}
	if !bsplit.ShouldEmbedBlockChanges(&md.data.UnrefBlocks) {
		err = fs.unembedBlockChanges(bps, md, &md.data.UnrefBlocks,
			tlfCryptKey, user)
		if err != nil {
			return Path{}, DirEntry{}, err
		}
	}

	// now write all the dirblocks to the cache and server
	// TODO: parallelize me
	bcache := fs.config.BlockCache()
	bops := fs.config.BlockOps()
	for i, id := range bps.ids {
		buf := bps.bufs[i]
		ctxt := bps.contexts[i]
		if err = bops.Put(id, ctxt, buf); err != nil {
			return Path{}, DirEntry{}, err
		}
		block := bps.blocks[i]
		if err = bcache.Put(id, block, false); err != nil {
			return Path{}, DirEntry{}, err
		}
	}

	// finally, write out the new metadata if we were not supposed to stop
	// early
	if stopAt == zeroId {
		md.data.LastWriter = user
		if err = fs.config.MDOps().Put(dir.TopDir, md); err != nil {
			return Path{}, DirEntry{}, err
		}
		err = fs.saveMdToCache(md)
		if err != nil {
			return Path{}, DirEntry{}, err
		}
	}

	return newPath, newDe, nil
}

func (fs *KBFSOpsStandard) syncBlockAndNotifyInChannel(md *RootMetadata,
	newBlock Block, dir Path, name string, entryType EntryType,
	mtime bool, ctime bool, stopAt BlockId) (p Path, de DirEntry, err error) {
	p, de, err = fs.syncBlockInChannel(md, newBlock, dir, name, entryType,
		mtime, ctime, stopAt)
	if err != nil {
		return
	}
	fs.notifyBatch(p.TopDir, []Path{p})
	return
}

// entryType must not by Sym.
func (fs *KBFSOpsStandard) createEntryInChannel(
	dir Path, name string, entryType EntryType) (Path, DirEntry, error) {
	// verify we have permission to write
	md, err := fs.getMDForWriteInChannel(dir)
	if err != nil {
		return Path{}, DirEntry{}, err
	}

	dblock, err := fs.getDirInChannel(dir, write)
	if err != nil {
		return Path{}, DirEntry{}, err
	}

	// does name already exist?
	if _, ok := dblock.Children[name]; ok {
		return Path{}, DirEntry{}, &NameExistsError{name}
	}

	// create new data block
	var newBlock Block
	// XXX: for now, put a unique ID in every new block, to make sure it
	// has a unique block ID. This may not be needed once we have encryption.
	if entryType == Dir {
		newBlock = &DirBlock{
			CommonBlock: CommonBlock{
				Seed: rand.Int63(),
			},
			Children: make(map[string]DirEntry),
		}
	} else {
		newBlock = &FileBlock{
			CommonBlock: CommonBlock{
				Seed: rand.Int63(),
			},
		}
	}

	// the parent's mtime/ctime also need to be updated
	if len(dir.Path) > 1 {
		if pblock, err := fs.getDirInChannel(*dir.ParentPath(), write); err == nil {
			parentDe := pblock.Children[dir.TailName()]
			parentDe.Mtime = time.Now().UnixNano()
			parentDe.Ctime = time.Now().UnixNano()
			pblock.Children[dir.TailName()] = parentDe
		} else {
			return Path{}, DirEntry{},
				&NoSuchBlockError{dir.ParentPath().TailPointer().Id}
		}
	} else {
		md.data.Dir.Mtime = time.Now().UnixNano()
		md.data.Dir.Ctime = time.Now().UnixNano()
	}

	return fs.syncBlockAndNotifyInChannel(md, newBlock, dir, name, entryType,
		true, true, zeroId)
}

func (fs *KBFSOpsStandard) CreateDir(dir Path, path string) (
	p Path, de DirEntry, err error) {
	rwchan, errchan := fs.getChans(dir.TopDir)
	rwchan.QueueWriteReq(func() {
		p, de, err = fs.createEntryInChannel(dir, path, Dir)
		errchan <- err
	})
	<-errchan
	return
}

func (fs *KBFSOpsStandard) CreateFile(dir Path, path string, isExec bool) (
	p Path, de DirEntry, err error) {
	var entryType EntryType
	if isExec {
		entryType = Exec
	} else {
		entryType = File
	}
	rwchan, errchan := fs.getChans(dir.TopDir)
	rwchan.QueueWriteReq(func() {
		p, de, err = fs.createEntryInChannel(dir, path, entryType)
		errchan <- err
	})
	<-errchan
	return
}

func (fs *KBFSOpsStandard) createLinkInChannel(
	dir Path, fromPath string, toPath string) (Path, DirEntry, error) {
	// verify we have permission to write
	md, err := fs.getMDForWriteInChannel(dir)
	if err != nil {
		return Path{}, DirEntry{}, err
	}

	dblock, err := fs.getDirInChannel(dir, write)
	if err != nil {
		return Path{}, DirEntry{}, err
	}

	// TODO: validate inputs

	// does name already exist?
	if _, ok := dblock.Children[fromPath]; ok {
		return Path{}, DirEntry{}, &NameExistsError{fromPath}
	}

	// Create a direntry for the link, and then sync
	dblock.Children[fromPath] = DirEntry{
		Type:    Sym,
		Size:    uint64(len(toPath)),
		SymPath: toPath,
		Mtime:   time.Now().UnixNano(),
		Ctime:   time.Now().UnixNano(),
	}

	newPath, _, err := fs.syncBlockAndNotifyInChannel(
		md, dblock, *dir.ParentPath(), dir.TailName(), Dir,
		true, true, zeroId)
	return newPath, dblock.Children[fromPath], err
}

func (fs *KBFSOpsStandard) CreateLink(
	dir Path, fromPath string, toPath string) (p Path, de DirEntry, err error) {
	rwchan, errchan := fs.getChans(dir.TopDir)
	rwchan.QueueWriteReq(func() {
		p, de, err = fs.createLinkInChannel(dir, fromPath, toPath)
		errchan <- err
	})
	<-errchan
	return
}

func (fs *KBFSOpsStandard) removeEntryInChannel(path Path) (Path, error) {
	parentPath := *path.ParentPath()
	name := path.TailName()
	// verify we have permission to write
	md, err := fs.getMDForWriteInChannel(parentPath)
	if err != nil {
		return Path{}, err
	}

	pblock, err := fs.getDirInChannel(parentPath, write)
	if err != nil {
		return Path{}, err
	}

	// make sure the entry exists
	de, ok := pblock.Children[name]
	if !ok {
		return Path{}, &NoSuchNameError{name}
	}

	md.AddUnrefBlock(path, de.BlockPointer)
	// If this is an indirect block, we need to delete all of its
	// children as well. (TODO: handle multiple levels of
	// indirection.)  NOTE: non-empty directories can't be removed, so
	// no need to check for indirect directory blocks here
	if de.Type == File || de.Type == Exec {
		block, err := fs.getBlockInChannel(path, de.Id, NewFileBlock, write)
		if err != nil {
			return Path{}, &NoSuchBlockError{de.Id}
		}
		fBlock, ok := block.(*FileBlock)
		if !ok {
			return Path{}, &NotFileError{path}
		}
		if fBlock.IsInd {
			for _, ptr := range fBlock.IPtrs {
				md.AddUnrefBlock(path, ptr.BlockPointer)
			}
		}
	}

	// the actual unlink
	delete(pblock.Children, name)

	// sync the parent directory
	newPath, _, err := fs.syncBlockAndNotifyInChannel(
		md, pblock, *parentPath.ParentPath(), parentPath.TailName(),
		Dir, true, true, zeroId)
	return newPath, err
}

func (fs *KBFSOpsStandard) RemoveDir(dir Path) (p Path, err error) {
	rwchan, errchan := fs.getChans(dir.TopDir)
	rwchan.QueueWriteReq(func() {
		// check for children of the directory, if we can
		var dblock *DirBlock
		dblock, err = fs.getDirInChannel(dir, read)
		if err == nil {
			if len(dblock.Children) > 0 {
				err = &DirNotEmptyError{dir.TailName()}
				errchan <- err
				return
			}
		}

		p, err = fs.removeEntryInChannel(dir)
		errchan <- err
	})
	<-errchan
	return
}

func (fs *KBFSOpsStandard) RemoveEntry(file Path) (p Path, err error) {
	rwchan, errchan := fs.getChans(file.TopDir)
	rwchan.QueueWriteReq(func() {
		p, err = fs.removeEntryInChannel(file)
		errchan <- err
	})
	<-errchan
	return
}

func (fs *KBFSOpsStandard) renameInChannel(
	oldParent Path, oldName string, newParent Path, newName string) (
	Path, Path, error) {
	// verify we have permission to write
	md, err := fs.getMDForWriteInChannel(oldParent)
	if err != nil {
		return Path{}, Path{}, err
	}

	// look up in the old path
	oldPBlock, err := fs.getDirInChannel(oldParent, write)
	if err != nil {
		return Path{}, Path{}, err
	}
	// does name exist?
	if _, ok := oldPBlock.Children[oldName]; !ok {
		return Path{}, Path{}, &NoSuchNameError{oldName}
	}

	// look up in the old path
	newPBlock, err := fs.getDirInChannel(newParent, write)
	if err != nil {
		return Path{}, Path{}, err
	}
	// does name exist?
	if _, ok := newPBlock.Children[newName]; ok {
		// TODO: delete the old block pointed to by this direntry
	}

	newDe := oldPBlock.Children[oldName]
	// only the ctime changes
	newDe.Ctime = time.Now().UnixNano()
	newPBlock.Children[newName] = newDe
	delete(oldPBlock.Children, oldName)

	// find the common ancestor
	var i int
	found := false
	// the root block will always be the same, so start at number 1
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
		newOldPath, _, err = fs.syncBlockInChannel(
			md, oldPBlock, *oldParent.ParentPath(), oldParent.TailName(),
			Dir, true, true, commonAncestor)
		if err != nil {
			return Path{}, Path{}, err
		}
	} else {
		// still need to update the old parent's times.
		parentPath := *oldParent.ParentPath()
		if len(parentPath.Path) > 0 {
			b, err := fs.getDirInChannel(parentPath, write)
			if err != nil {
				return Path{}, Path{}, err
			}
			if de, ok := b.Children[oldParent.TailName()]; ok {
				de.Ctime = time.Now().UnixNano()
				de.Mtime = time.Now().UnixNano()
				b.Children[oldParent.TailName()] = de
			}
		} else {
			md.data.Dir.Ctime = time.Now().UnixNano()
			md.data.Dir.Mtime = time.Now().UnixNano()
		}
	}

	newNewPath, _, err := fs.syncBlockInChannel(
		md, newPBlock, *newParent.ParentPath(), newParent.TailName(),
		Dir, true, true, zeroId)
	if err != nil {
		return Path{}, Path{}, err
	}

	// newOldPath is really just a prefix now.  A copy is necessary as an
	// append could cause the new path to contain nodes from the old path.
	newOldPath.Path = append(make([]PathNode, i+1, i+1), newOldPath.Path...)
	copy(newOldPath.Path[:i+1], newNewPath.Path[:i+1])

	fs.notifyBatch(newOldPath.TopDir, []Path{newOldPath, newNewPath})
	return newOldPath, newNewPath, nil
}

func (fs *KBFSOpsStandard) Rename(
	oldParent Path, oldName string, newParent Path, newName string) (
	oldP Path, newP Path, err error) {
	// only works for paths within the same topdir
	if (oldParent.TopDir != newParent.TopDir) ||
		(oldParent.Path[0].Id != newParent.Path[0].Id) {
		return Path{}, Path{}, &RenameAcrossDirsError{}
	}

	rwchan, errchan := fs.getChans(oldParent.TopDir)
	rwchan.QueueWriteReq(func() {
		oldP, newP, err =
			fs.renameInChannel(oldParent, oldName, newParent, newName)
		errchan <- err
	})
	<-errchan
	return
}

func (fs *KBFSOpsStandard) getFileBlockAtOffset(
	file Path, topBlock *FileBlock, off int64, rtype reqType) (
	id BlockId, parentBlock *FileBlock, indexInParent int, block *FileBlock,
	more bool, startOff int64, err error) {
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
		parentBlock = block
		indexInParent = nextIndex
		startOff = nextPtr.Off
		newPath := file
		// there is more to read if we ever took a path through a
		// ptr that wasn't the final ptr in its respective list
		more = more || (nextIndex != len(block.IPtrs)-1)
		id = nextPtr.Id
		newPath.Path = append(newPath.Path, PathNode{
			nextPtr.BlockPointer, file.TailName(),
		})
		if block, err = fs.getFileInChannel(newPath, rtype); err != nil {
			return
		}
		if nextPtr.QuotaSize > 0 && nextPtr.QuotaSize < uint32(len(block.Contents)) {
			err = &TooHighByteCountError{
				ExpectedMaxByteCount: int(nextPtr.QuotaSize),
				ByteCount:            len(block.Contents),
			}
		}
	}

	return
}

func (fs *KBFSOpsStandard) readInChannel(file Path, dest []byte, off int64) (
	int64, error) {
	// getFileInChannel already checks read permissions
	fblock, err := fs.getFileInChannel(file, read)
	if err != nil {
		return 0, err
	}

	nRead := int64(0)
	n := int64(len(dest))

	for nRead < n {
		nextByte := nRead + off
		toRead := n - nRead
		_, _, _, block, _, startOff, err :=
			fs.getFileBlockAtOffset(file, fblock, nextByte, read)
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

func (fs *KBFSOpsStandard) Read(file Path, dest []byte, off int64) (
	numRead int64, err error) {
	fs.execReadInChannel(file.TopDir, func(rtype reqType) error {
		numRead, err = fs.readInChannel(file, dest, off)
		return err
	})
	return
}

func (fs *KBFSOpsStandard) getEntryInChannel(file Path) (
	*DirBlock, DirEntry, error) {
	parentPath := file.ParentPath()
	dblock, err := fs.getDirInChannel(*parentPath, write)
	if err != nil {
		return nil, DirEntry{}, err
	}

	// make sure it exists
	name := file.TailName()
	if de, ok := dblock.Children[name]; !ok {
		return nil, DirEntry{}, &NoSuchNameError{name}
	} else {
		return dblock, de, err
	}
}

func (fs *KBFSOpsStandard) newRightBlockInChannel(
	id BlockId, pblock *FileBlock, off int64, md *RootMetadata) error {
	newRId, err := fs.config.Crypto().MakeRandomBlockId()
	if err != nil {
		return err
	}
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
		BlockPointer{newRId, md.LatestKeyVersion(), fs.config.DataVersion(), user, 0},
		off})
	if err := fs.config.BlockCache().Put(id, pblock, true); err != nil {
		return err
	}
	return nil
}

func (fs *KBFSOpsStandard) writeDataInChannel(
	file Path, data []byte, off int64) error {
	// verify we have permission to write
	md, err := fs.getMDForWriteInChannel(file)
	if err != nil {
		return err
	}

	fblock, err := fs.getFileInChannel(file, write)
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
		id, parentBlock, indexInParent, block, more, startOff, err :=
			fs.getFileBlockAtOffset(file, fblock, off+nCopied, write)
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
				newId, err := fs.config.Crypto().MakeRandomBlockId()
				if err != nil {
					return err
				}
				fblock = &FileBlock{
					CommonBlock: CommonBlock{
						IsInd: true,
						Seed:  rand.Int63(),
					},
					IPtrs: []IndirectFilePtr{
						IndirectFilePtr{
							BlockPointer{newId, md.LatestKeyVersion(),
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
			if err := fs.newRightBlockInChannel(file.TailPointer().Id, fblock,
				startOff+int64(len(block.Contents)), md); err != nil {
				return err
			}
		}

		if dblock, de, err := fs.getEntryInChannel(file); err == nil {
			if oldLen != len(block.Contents) || de.Writer != user {
				// remember how many bytes it was
				md.AddUnrefBlock(file, de.BlockPointer)
				de.QuotaSize = 0
				// update the file info
				de.Size += uint64(len(block.Contents) - oldLen)
				de.Writer = user
				dblock.Children[file.TailName()] = de
				// the copy will be dirty, so put it in the cache
				bcache.Put(
					file.ParentPath().TailPointer().Id, dblock, true)
			}
		} else {
			return err
		}

		if parentBlock != nil {
			// remember how many bytes it was
			md.AddUnrefBlock(file,
				parentBlock.IPtrs[indexInParent].BlockPointer)
			parentBlock.IPtrs[indexInParent].QuotaSize = 0
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

	err = fs.saveMdToCache(md)
	if err != nil {
		return err
	}

	fs.notifyLocal(file)
	return nil
}

func (fs *KBFSOpsStandard) Write(file Path, data []byte, off int64) error {
	// Even though writing doesn't change the directory, we still use a
	// write request since it is changing the contents of file blocks
	rwchan, errchan := fs.getChans(file.TopDir)
	rwchan.QueueWriteReq(func() {
		errchan <- fs.writeDataInChannel(file, data, off)
	})
	return <-errchan
}

func (fs *KBFSOpsStandard) truncateInChannel(file Path, size uint64) error {
	// verify we have permission to write
	md, err := fs.getMDForWriteInChannel(file)
	if err != nil {
		return err
	}

	fblock, err := fs.getFileInChannel(file, write)
	if err != nil {
		return err
	}

	// find the block where the file should now end
	iSize := int64(size) // TODO: deal with overflow
	id, parentBlock, indexInParent, block, more, startOff, err :=
		fs.getFileBlockAtOffset(file, fblock, iSize, write)

	currLen := int64(startOff) + int64(len(block.Contents))
	if currLen < iSize {
		// if we need to extend the file, let's just do a write
		moreNeeded := iSize - currLen
		return fs.writeDataInChannel(
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
		// TODO: if indexInParent == 0, we can remove the level of indirection
		for _, ptr := range parentBlock.IPtrs[indexInParent+1:] {
			md.AddUnrefBlock(file, ptr.BlockPointer)
		}
		parentBlock.IPtrs = parentBlock.IPtrs[:indexInParent+1]
		// always make the parent block dirty, so we will sync it
		// TODO: When we implement more than one level of indirection,
		// make sure that the pointer to parentBlock in the grandparent block
		// has QuotaSize 0.
		if err := fs.config.BlockCache().Put(
			file.TailPointer().Id, parentBlock, true); err != nil {
			return err
		}
	}

	if parentBlock != nil {
		md.AddUnrefBlock(file, parentBlock.IPtrs[indexInParent].BlockPointer)
		parentBlock.IPtrs[indexInParent].QuotaSize = 0
	}

	// update the local entry size
	dblock, de, err := fs.getEntryInChannel(file)
	if err != nil {
		return err
	}

	md.AddUnrefBlock(file, de.BlockPointer)
	de.QuotaSize = 0
	de.Size = size
	de.Writer = user
	dblock.Children[file.TailName()] = de
	// the copy will be dirty, so put it in the cache
	// TODO: Once we implement indirect dir blocks, make sure that
	// the pointer to dblock in its parent block has QuotaSize 0.
	fs.config.BlockCache().Put(
		file.ParentPath().TailPointer().Id, dblock, true)

	// keep the old block ID while it's dirty
	err = fs.config.BlockCache().Put(id, block, true)
	if err != nil {
		return err
	}

	err = fs.saveMdToCache(md)
	if err != nil {
		return err
	}

	fs.notifyLocal(file)
	return nil
}

func (fs *KBFSOpsStandard) Truncate(file Path, size uint64) error {
	rwchan, errchan := fs.getChans(file.TopDir)
	rwchan.QueueWriteReq(func() {
		errchan <- fs.truncateInChannel(file, size)
	})
	return <-errchan
}

func (fs *KBFSOpsStandard) setExInChannel(file Path, ex bool) (
	newPath Path, err error) {
	dblock, de, err := fs.getEntryInChannel(file)
	if err != nil {
		return
	}

	// If the file is a symlink, do nothing (to match ext4
	// behavior).
	if de.Type == Sym {
		return
	}

	// verify we have permission to write
	md, err := fs.getMDForWriteInChannel(file)
	if err != nil {
		return
	}

	if ex && (de.Type == File) {
		de.Type = Exec
	} else if !ex && (de.Type == Exec) {
		de.Type = File
	}
	// If the type isn't File or Exec, there's nothing to do, but
	// change the ctime anyway (to match ext4 behavior).
	de.Ctime = time.Now().UnixNano()
	dblock.Children[file.TailName()] = de
	parentPath := file.ParentPath()
	newParentPath, _, err := fs.syncBlockInChannel(
		md, dblock, *parentPath.ParentPath(), parentPath.TailName(),
		Dir, false, false, zeroId)

	newPath = Path{file.TopDir,
		append(newParentPath.Path, file.Path[len(file.Path)-1])}
	fs.notifyBatch(file.TopDir, []Path{newPath})
	return
}

func (fs *KBFSOpsStandard) SetEx(file Path, ex bool) (newPath Path, err error) {
	rwchan, errchan := fs.getChans(file.TopDir)
	rwchan.QueueWriteReq(func() {
		newPath, err = fs.setExInChannel(file, ex)
		errchan <- err
	})
	<-errchan
	return
}

func (fs *KBFSOpsStandard) setMtimeInChannel(file Path, mtime *time.Time) (
	Path, error) {
	// verify we have permission to write
	md, err := fs.getMDForWriteInChannel(file)
	if err != nil {
		return Path{}, err
	}

	dblock, de, err := fs.getEntryInChannel(file)
	if err != nil {
		return Path{}, err
	}

	de.Mtime = mtime.UnixNano()
	// setting the mtime counts as changing the file MD, so must set ctime too
	de.Ctime = time.Now().UnixNano()
	dblock.Children[file.TailName()] = de
	parentPath := file.ParentPath()
	newParentPath, _, err := fs.syncBlockInChannel(
		md, dblock, *parentPath.ParentPath(), parentPath.TailName(),
		Dir, false, false, zeroId)
	newPath := Path{file.TopDir,
		append(newParentPath.Path, file.Path[len(file.Path)-1])}
	fs.notifyBatch(file.TopDir, []Path{newPath})
	return newPath, err
}

func (fs *KBFSOpsStandard) SetMtime(file Path, mtime *time.Time) (
	p Path, err error) {
	if mtime == nil {
		// Can happen on some OSes (e.g. OSX) when trying to set the atime only
		return file, nil
	}

	rwchan, errchan := fs.getChans(file.TopDir)
	rwchan.QueueWriteReq(func() {
		p, err = fs.setMtimeInChannel(file, mtime)
		errchan <- err
	})
	<-errchan
	return
}

func (fs *KBFSOpsStandard) syncInChannel(file Path) (Path, error) {
	// if the cache for this file isn't dirty, we're done
	bcache := fs.config.BlockCache()
	id := file.TailPointer().Id
	if !bcache.IsDirty(id) {
		return file, nil
	}

	// verify we have permission to write
	md, err := fs.getMDForWriteInChannel(file)
	if err != nil {
		return Path{}, err
	}

	// update the parent directories, and write all the new blocks out
	// to disk
	fblock, err := fs.getFileInChannel(file, write)
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
			isDirty := bcache.IsDirty(ptr.Id)
			if (ptr.QuotaSize > 0) && isDirty {
				return Path{}, &InconsistentBlockPointerError{ptr.BlockPointer}
			}
			if isDirty {
				_, _, _, block, more, _, err :=
					fs.getFileBlockAtOffset(file, fblock, ptr.Off, write)
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
						if err := fs.newRightBlockInChannel(
							file.TailPointer().Id, fblock,
							endOfBlock, md); err != nil {
							return Path{}, err
						}
					}
					rId, _, _, rblock, _, _, err :=
						fs.getFileBlockAtOffset(file, fblock, endOfBlock, write)
					if err != nil {
						return Path{}, err
					}
					rblock.Contents = append(extraBytes, rblock.Contents...)
					if err := fs.config.BlockCache().Put(
						rId, rblock, true); err != nil {
						return Path{}, err
					}
					fblock.IPtrs[i+1].Off = ptr.Off + int64(len(block.Contents))
					md.AddUnrefBlock(file, fblock.IPtrs[i+1].BlockPointer)
					fblock.IPtrs[i+1].QuotaSize = 0
				case splitAt < 0:
					if !more {
						// end of the line
						continue
					}

					endOfBlock := ptr.Off + int64(len(block.Contents))
					rId, _, _, rblock, _, _, err :=
						fs.getFileBlockAtOffset(file, fblock, endOfBlock, write)
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
						md.AddUnrefBlock(file, fblock.IPtrs[i+1].BlockPointer)
						fblock.IPtrs[i+1].QuotaSize = 0
					} else {
						// TODO: delete the block, and if we're down to just
						// one indirect block, remove the layer of indirection
						// TODO: When we implement more than one level of indirection,
						// make sure that the pointer to the parent block in the
						// grandparent block has QuotaSize 0.
						md.AddUnrefBlock(file, fblock.IPtrs[i+1].BlockPointer)
						fblock.IPtrs =
							append(fblock.IPtrs[:i+1], fblock.IPtrs[i+2:]...)
					}
				}
			}
		}

		tlfCryptKey, err := fs.config.KeyManager().GetTLFCryptKey(file, md)
		if err != nil {
			return Path{}, err
		}
		bops := fs.config.BlockOps()
		for i, ptr := range fblock.IPtrs {
			// TODO: parallelize these?
			isDirty := bcache.IsDirty(ptr.Id)
			if (ptr.QuotaSize > 0) && isDirty {
				return Path{}, &InconsistentBlockPointerError{ptr.BlockPointer}
			}
			if isDirty {
				_, _, _, block, _, _, err :=
					fs.getFileBlockAtOffset(file, fblock, ptr.Off, write)
				if err != nil {
					return Path{}, err
				}

				id, _, buf, err := fs.readyBlock(block, tlfCryptKey)
				if err != nil {
					return Path{}, err
				}

				bcache.Finalize(ptr.Id, id)
				fblock.IPtrs[i].QuotaSize = uint32(len(buf))
				fblock.IPtrs[i].Id = id
				fblock.IPtrs[i].Writer = user
				md.AddRefBlock(file, fblock.IPtrs[i].BlockPointer)
				if err := bops.Put(id, &fblock.IPtrs[i], buf); err != nil {
					return Path{}, err
				}
			}
		}
	}

	parentPath := file.ParentPath()
	newPath, _, err :=
		fs.syncBlockAndNotifyInChannel(md, fblock, *parentPath, file.TailName(),
			File, true, true, zeroId)
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

func (fs *KBFSOpsStandard) Sync(file Path) (p Path, err error) {
	rwchan, errchan := fs.getChans(file.TopDir)
	rwchan.QueueWriteReq(func() {
		p, err = fs.syncInChannel(file)
		errchan <- err
	})
	<-errchan
	return
}

// Notifier:

func (fs *KBFSOpsStandard) RegisterForChanges(
	dirs []DirId, obs Observer) error {
	fs.globalStateLock.Lock()
	defer fs.globalStateLock.Unlock()
	for _, dir := range dirs {
		// It's the caller's responsibility to make sure
		// RegisterForChanges isn't called twice for the same Observer
		fs.observers[dir] = append(fs.observers[dir], obs)
	}
	return nil
}

func (fs *KBFSOpsStandard) UnregisterFromChanges(
	dirs []DirId, obs Observer) error {
	fs.globalStateLock.Lock()
	defer fs.globalStateLock.Unlock()
	for _, dir := range dirs {
		ns := fs.observers[dir]
		for i, oldObs := range ns {
			if oldObs == obs {
				fs.observers[dir] = append(ns[:i], ns[i+1:]...)
				break
			}
		}
	}
	return nil
}

func (fs *KBFSOpsStandard) notifyLocal(path Path) {
	fs.globalStateLock.RLock()
	defer fs.globalStateLock.RUnlock()
	for _, obs := range fs.observers[path.TopDir] {
		obs.LocalChange(path)
	}
}

func (fs *KBFSOpsStandard) notifyBatch(dir DirId, paths []Path) {
	fs.globalStateLock.RLock()
	defer fs.globalStateLock.RUnlock()
	for _, obs := range fs.observers[dir] {
		obs.BatchChanges(dir, paths)
	}
}
