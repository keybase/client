package libkbfs

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

// reqType indicates whether an operation makes MD modifications or not
type reqType int

const (
	read  reqType = iota // A read request
	write         = iota // A write request
)

type branchType int

const (
	standard       branchType = iota // an online, read-write branch
	archive                   = iota // an online, read-only branch
	offline                   = iota // an offline, read-write branch
	archiveOffline            = iota // an offline, read-only branch
)

type syncInfo struct {
	oldInfo BlockInfo
	op      *syncOp
	unrefs  []BlockInfo
}

// FolderBranchOps implements the KBFSOps interface for a specific
// branch of a specific folder.  It is go-routine safe for operations
// within the folder.
//
// We use locks to protect against multiple goroutines accessing the
// same folder-branch.  The goal with our locking strategy is maximize
// concurrent access whenever possible.  See design/state_machine.md
// for more details.  There are three important locks:
//
// 1) writerLock: Any "remote-sync" operation (one which modifies the
//    folder's metadata) must take this lock during the entirety of
//    its operation, to avoid forking the MD.
//
// 2) headLock: This is a read/write mutex.  It must be taken for
//    reading before accessing any part of the current head MD.  It
//    should be taken for the shortest time possible -- that means in
//    general that it should be taken, and the MD copied to a
//    goroutine-local variable, and then it can be released.
//    Remote-sync operations should take it for writing after pushing
//    all of the blocks and MD to the KBFS servers (i.e., all network
//    accesses), and then hold it until after all notifications have
//    been fired, to ensure that no concurrent "local" operations ever
//    see inconsistent state locally.
//
// 3) blockLock: This too is a read/write mutex.  It must be taken for
//    reading before accessing any blocks in the block cache that
//    belong to this folder/branch.  This includes checking their
//    dirty status.  It should be taken for the shortest time possible
//    -- that means in general it should be taken, and then the blocks
//    that will be modified should be copied to local variables in the
//    goroutine, and then it should be released.  The blocks should
//    then be modified locally, and then readied and pushed out
//    remotely.  Only after the blocks have been pushed to the server
//    should a remote-sync operation take the lock again (this time
//    for writing) and put/finalize the blocks.  Write and Truncate
//    should take blockLock for their entire lifetime, since they
//    don't involve writes over the network.  Furthermore, if a block
//    is not in the cache and needs to be fetched, we should release
//    the mutex before doing the network operation, and lock it again
//    before writing the block back to the cache.
//
// We want to allow writes and truncates to a file that's currently
// being sync'd, like any good networked file system.  The tricky part
// is making sure the changes can both: a) be read while the sync is
// happening, and b) be applied to the new file path after the sync is
// done.
//
// For now, we just do the dumb, brute force thing for now: if a block
// is currently being sync'd, it copies the block and puts it back
// into the cache as modified.  Then, when the sync finishes, it
// throws away the modified blocks and re-applies the change to the
// new file path (which might have a completely different set of
// blocks, so we can't just reuse the blocks that were modified during
// the sync.)
type FolderBranchOps struct {
	config           Config
	id               DirID
	branch           BranchName
	bType            branchType
	head             *RootMetadata
	observers        []Observer
	blockWriteLocked bool // blockLock is locked for writing tracks
	// Which blocks are currently being synced, so that writes and
	// truncates can do copy-on-write to avoid messing up the ongoing
	// sync.  The bool value is true if the block needs to be
	// copied before written to.
	copyFileBlocks map[BlockPointer]bool
	// Writes and truncates for blocks that were being sync'd, and
	// need to be replayed after the sync finishes on top of the new
	// versions of the blocks.
	deferredWrites []func(context.Context, *RootMetadata, Path) error
	// set to true if this write or truncate should be deferred
	doDeferWrite bool
	// For writes and truncates, track the unsynced to-be-unref'd
	// block infos, per-path
	unrefCache map[BlockPointer]*syncInfo
	// For writes and truncates, track the modified (but not yet
	// committed) directory entries.  The outer map maps the parent
	// BlockPointer to the inner map, which maps the entry
	// BlockPointer to a modified entry.
	deCache map[BlockPointer]map[BlockPointer]DirEntry

	// these locks, when locked concurrently by the same goroutine,
	// should only be taken in the following order to avoid deadlock:
	writerLock sync.Locker  // taken by any method making MD modifications
	headLock   sync.RWMutex // protects access to the MD

	// protects access to blocks in this folder and to
	// copyFileBlocks/deferredWrites
	blockLock sync.RWMutex

	obsLock   sync.RWMutex // protects access to observers
	cacheLock sync.Mutex   // protects unrefCache and deCache

	nodeCache NodeCache
}

var _ KBFSOps = (*FolderBranchOps)(nil)

// NewFolderBranchOps constructs a new FolderBranchOps object.
func NewFolderBranchOps(config Config, id DirID, branch BranchName,
	bType branchType) *FolderBranchOps {
	return &FolderBranchOps{
		config:         config,
		id:             id,
		branch:         branch,
		bType:          bType,
		observers:      make([]Observer, 0),
		copyFileBlocks: make(map[BlockPointer]bool),
		deferredWrites: make(
			[]func(context.Context, *RootMetadata, Path) error, 0),
		unrefCache: make(map[BlockPointer]*syncInfo),
		deCache:    make(map[BlockPointer]map[BlockPointer]DirEntry),
		writerLock: &sync.Mutex{},
		nodeCache:  newNodeCacheStandard(id, branch),
	}
}

// Shutdown safely shuts down any background goroutines that may have
// been launched by FolderBranchOps.
func (fbo *FolderBranchOps) Shutdown() {
	// Nothing to do right now
}

// GetFavDirs implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) GetFavDirs(ctx context.Context) ([]DirID, error) {
	return nil, fmt.Errorf("GetFavDirs is not supported by FolderBranchOps")
}

func (fbo *FolderBranchOps) checkDataVersion(dir Path) error {
	dataVer := fbo.config.DataVersion()
	if len(dir.Path) > 0 {
		dataVer = dir.TailPointer().DataVer
	}
	if dataVer < FirstValidDataVer {
		return InvalidDataVersionError{dataVer}
	}
	if dataVer > fbo.config.DataVersion() {
		return NewDataVersionError{dir, dataVer}
	}
	return nil
}

// if rtype == write, then writerLock must be taken
func (fbo *FolderBranchOps) getMDLocked(rtype reqType) (
	*RootMetadata, error) {
	fbo.headLock.RLock()
	if fbo.head != nil {
		fbo.headLock.RUnlock()
		return fbo.head, nil
	}
	fbo.headLock.RUnlock()

	// if we're in read mode, we can't safely fetch the new MD without
	// causing races, so bail
	if rtype == read {
		return nil, WriteNeededInReadRequest{}
	}

	// not in cache, fetch from server and add to cache
	mdops := fbo.config.MDOps()
	md, err := mdops.GetForTLF(fbo.id)
	if err != nil {
		return nil, err
	}

	if md.data.Dir.Type != Dir {
		err = fbo.initMDLocked(md)
	} else {
		// if already initialized, store directly in cache
		mdID, err := md.MetadataID(fbo.config)
		if err != nil {
			return nil, err
		}

		fbo.headLock.Lock()
		defer fbo.headLock.Unlock()
		fbo.head = md
		err = fbo.config.MDCache().Put(mdID, md)
	}

	return md, err
}

// if rtype == write, then writerLock must be taken
func (fbo *FolderBranchOps) getMDForReadLocked(rtype reqType) (
	*RootMetadata, error) {
	md, err := fbo.getMDLocked(rtype)
	if err != nil {
		return nil, err
	}

	user, err := fbo.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return nil, err
	}
	if !md.GetDirHandle().IsReader(user) {
		return nil, NewReadAccessError(fbo.config, md.GetDirHandle(), user)
	}
	return md, nil
}

// writerLock must be taken by the caller.
func (fbo *FolderBranchOps) getMDForWriteLocked() (
	*RootMetadata, error) {
	md, err := fbo.getMDLocked(write)
	if err != nil {
		return nil, err
	}

	user, err := fbo.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return nil, err
	}
	if !md.GetDirHandle().IsWriter(user) {
		return nil, NewWriteAccessError(fbo.config, md.GetDirHandle(), user)
	}

	// Make a copy of the MD for changing.  The caller must pass this
	// into syncBlockLocked or the changes will be lost.
	newMd := md.DeepCopy()
	return &newMd, nil
}

// writerLock must be taken
func (fbo *FolderBranchOps) initMDLocked(md *RootMetadata) error {
	// create a dblock since one doesn't exist yet
	user, err := fbo.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return err
	}

	handle := md.GetDirHandle()

	if !handle.IsWriter(user) {
		return NewWriteAccessError(fbo.config, handle, user)
	}

	newDblock := &DirBlock{
		CommonBlock: CommonBlock{
			Seed: rand.Int63(),
		},
		Children: make(map[string]DirEntry),
	}

	var expectedKeyGen KeyGen
	if md.ID.IsPublic() {
		md.Writers = make([]keybase1.UID, len(handle.Writers))
		copy(md.Writers, handle.Writers)
		expectedKeyGen = PublicKeyGen
	} else {
		// create a new set of keys for this metadata
		if err := fbo.config.KeyManager().Rekey(md); err != nil {
			return err
		}
		expectedKeyGen = FirstValidKeyGen
	}
	keyGen := md.LatestKeyGeneration()
	if keyGen != expectedKeyGen {
		return InvalidKeyGenerationError{*handle, keyGen}
	}
	info, plainSize, readyBlockData, err := fbo.readyBlock(md, newDblock, user)
	if err != nil {
		return err
	}

	md.data.Dir = DirEntry{
		BlockInfo: info,
		Type:      Dir,
		Size:      uint64(plainSize),
		Mtime:     time.Now().UnixNano(),
		Ctime:     time.Now().UnixNano(),
	}
	md.AddOp(newCreateOp("", BlockPointer{}))
	md.AddRefBlock(md.data.Dir.BlockInfo)
	md.UnrefBytes = 0

	// make sure we're a writer before putting any blocks
	if !handle.IsWriter(user) {
		return NewWriteAccessError(fbo.config, handle, user)
	}

	if err = fbo.config.BlockOps().Put(md, info.BlockPointer, readyBlockData); err != nil {
		return err
	}
	if err = fbo.config.BlockCache().Put(info.ID, newDblock); err != nil {
		return err
	}

	// finally, write out the new metadata
	md.data.LastWriter = user
	if err = fbo.config.MDOps().Put(md.ID, md, nil, NullMdID); err != nil {
		return err
	}
	if mdID, err := md.MetadataID(fbo.config); err != nil {
		return err
	} else if err = fbo.config.MDCache().Put(mdID, md); err != nil {
		return err
	} else {
		fbo.headLock.Lock()
		defer fbo.headLock.Unlock()
		if fbo.head != nil {
			headID, _ := fbo.head.MetadataID(fbo.config)
			return fmt.Errorf(
				"%v: Unexpected MD ID during new MD initialization: %v",
				md.ID, headID)
		}
		fbo.head = md
	}
	return nil
}

// GetOrCreateRootNodeForHandle implements the KBFSOps interface for
// FolderBranchOps
func (fbo *FolderBranchOps) GetOrCreateRootNodeForHandle(
	ctx context.Context, handle *DirHandle) (
	node Node, de DirEntry, err error) {
	err = fmt.Errorf("GetOrCreateRootNodeForHandle is not supported by " +
		"FolderBranchOps")
	return
}

func (fbo *FolderBranchOps) checkNode(node Node) error {
	id, branch := node.GetFolderBranch()
	if id != fbo.id || branch != fbo.branch {
		return WrongOpsError{fbo.id, fbo.branch, id, branch}
	}
	return nil
}

// CheckForNewMDAndInit sees whether the given MD object has been
// initialized yet; if not, it does so.
func (fbo *FolderBranchOps) CheckForNewMDAndInit(
	ctx context.Context, md *RootMetadata) error {
	if md.ID != fbo.id {
		return WrongOpsError{fbo.id, fbo.branch, md.ID, MasterBranch}
	}

	if md.data.Dir.Type == Dir {
		// this MD is already initialized
		return nil
	}

	// otherwise, intialize
	fbo.writerLock.Lock()
	defer fbo.writerLock.Unlock()
	return fbo.initMDLocked(md)
}

// execReadThenWrite first tries to execute the passed-in method in
// read mode.  If it fails with a WriteNeededInReadRequest error, it
// re-executes the method as in write mode.  The passed-in method
// must note whether or not this is a write call.
func (fbo *FolderBranchOps) execReadThenWrite(f func(reqType) error) error {
	err := f(read)

	// Redo as a write request if needed
	if _, ok := err.(WriteNeededInReadRequest); ok {
		fbo.writerLock.Lock()
		defer fbo.writerLock.Unlock()
		err = f(write)
	}
	return err
}

// GetRootNode implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) GetRootNode(ctx context.Context, dir DirID) (
	node Node, de DirEntry, handle *DirHandle, err error) {
	if dir != fbo.id {
		err = WrongOpsError{fbo.id, fbo.branch, dir, MasterBranch}
		return
	}

	// don't check read permissions here -- anyone should be able to read
	// the MD to determine whether there's a public subdir or not
	var md *RootMetadata
	err = fbo.execReadThenWrite(func(rtype reqType) error {
		md, err = fbo.getMDLocked(rtype)
		return err
	})
	if err != nil {
		return
	}

	handle = md.GetDirHandle()
	node, err = fbo.nodeCache.GetOrCreate(stripBP(md.data.Dir.BlockPointer),
		handle.ToString(fbo.config), nil)
	if err != nil {
		node = nil
		return
	}
	de = md.Data().Dir
	return
}

type makeNewBlock func() Block

// blockLock should be taken for reading by the caller.
func (fbo *FolderBranchOps) getBlockLocked(md *RootMetadata,
	dir Path, newBlock makeNewBlock, rtype reqType) (Block, error) {
	/**
	* TODO: move to lookup
		 	err := fbo.checkDataVersion(dir)
			if err != nil {
				return nil, err
			}
	*/

	bcache := fbo.config.BlockCache()
	if block, err := bcache.Get(dir.TailPointer(), dir.Branch); err == nil {
		return block, nil
	}

	// Unlock the blockLock while we wait for the network, only if
	// it's locked for reading.  If it's locked for writing, that
	// indicates we are performing an atomic write operation, and we
	// need to ensure that nothing else comes in and modifies the
	// blocks, so don't unlock.
	doLock := true
	if !fbo.blockWriteLocked {
		fbo.blockLock.RUnlock()
		defer func() {
			if doLock {
				fbo.blockLock.RLock()
			}
		}()
	}
	// TODO: add an optimization here that will avoid fetching the
	// same block twice from over the network

	// fetch the block, and add to cache
	block := newBlock()
	bops := fbo.config.BlockOps()
	if err := bops.Get(md, dir.TailPointer(), block); err != nil {
		return nil, err
	}

	// relock before accessing the cache
	doLock = false
	if !fbo.blockWriteLocked {
		fbo.blockLock.RLock()
	}
	if err := bcache.Put(dir.TailPointer().ID, block); err != nil {
		return nil, err
	}
	return block, nil
}

// getDirLocked returns the directory block at the given path.
// When rType == write and the cached version of the block is
// currently clean, this method makes a copy of the directory block
// and returns it.  If this method might be called again for the same
// block within a single operation, it is the caller's responsibility
// to write that block copy back to the cache as dirty.
//
// blockLock should be taken for reading by the caller, and writerLock
// too if rtype == write.
func (fbo *FolderBranchOps) getDirLocked(
	md *RootMetadata, dir Path, rtype reqType) (*DirBlock, error) {
	// get the directory for the last element in the path
	block, err := fbo.getBlockLocked(md, dir, NewDirBlock, rtype)
	if err != nil {
		return nil, err
	}
	dblock, ok := block.(*DirBlock)
	if !ok {
		return nil, NotDirError{dir}
	}
	if rtype == write && !fbo.config.BlockCache().IsDirty(
		dir.TailPointer(), dir.Branch) {
		// copy the block if it's for writing
		dblock = dblock.DeepCopy()
	}
	return dblock, nil
}

// getFileLocked returns the file block at the given path.  When
// rType == write and the cached version of the block is currently
// clean, this method makes a copy of the file block and returns it.
// If this method might be called again for the same block within a
// single operation, it is the caller's responsibility to write that
// block back to the cache as dirty.
//
// blockLock should be taken for reading by the caller, and writerLock
// too if rtype == write.
func (fbo *FolderBranchOps) getFileLocked(
	md *RootMetadata, file Path, rtype reqType) (*FileBlock, error) {
	// get the file for the last element in the path
	block, err := fbo.getBlockLocked(md, file, NewFileBlock, rtype)
	if err != nil {
		return nil, err
	}
	fblock, ok := block.(*FileBlock)
	if !ok {
		return nil, &NotFileError{file}
	}
	ptr := file.TailPointer()
	if rtype == write {
		// copy the block if it's for writing, and either the block is
		// not yet dirty or the block is currently being sync'd and
		// needs a copy even though it's already dirty
		if !fbo.config.BlockCache().IsDirty(ptr, file.Branch) ||
			fbo.copyFileBlocks[ptr] {
			fblock = fblock.DeepCopy()
		}
	}
	return fblock, nil
}

// TODO: get rid of this function once we move the other extraneous
// pointer fields into BlockInfo
func stripBP(ptr BlockPointer) BlockPointer {
	return BlockPointer{
		ID:       ptr.ID,
		RefNonce: ptr.RefNonce,
		KeyGen:   ptr.KeyGen,
		DataVer:  ptr.DataVer,
	}
}

func (fbo *FolderBranchOps) updateDirBlock(
	dir Path, block *DirBlock) *DirBlock {
	// see if this directory has any outstanding writes/truncates that
	// require an updated DirEntry
	fbo.cacheLock.Lock()
	defer fbo.cacheLock.Unlock()
	deMap, ok := fbo.deCache[stripBP(dir.TailPointer())]
	if ok {
		// do a deep copy, replacing direntries as we go
		dblockCopy := NewDirBlock().(*DirBlock)
		*dblockCopy = *block
		dblockCopy.Children = make(map[string]DirEntry)
		for k, v := range block.Children {
			if de, ok := deMap[stripBP(v.BlockPointer)]; ok {
				dblockCopy.Children[k] = de
			} else {
				dblockCopy.Children[k] = v
			}
		}
		return dblockCopy
	}
	return block
}

// GetDirChildren implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) GetDirChildren(ctx context.Context, dir Node) (
	children map[string]EntryType, err error) {
	err = fbo.checkNode(dir)
	if err != nil {
		return
	}

	md, err := fbo.getMDForReadLocked(read)
	if err != nil {
		return nil, err
	}

	fbo.blockLock.RLock()
	defer fbo.blockLock.RUnlock()
	dirPath := fbo.nodeCache.PathFromNode(dir)
	var block *DirBlock
	fbo.execReadThenWrite(func(rtype reqType) error {
		block, err = fbo.getDirLocked(md, dirPath, rtype)
		return err
	})
	if err != nil {
		return
	}

	children = make(map[string]EntryType)
	for k, de := range block.Children {
		children[k] = de.Type
	}
	return
}

// blockLocked must be taken for reading by the caller.
func (fbo *FolderBranchOps) getEntryLocked(md *RootMetadata, file Path) (
	*DirBlock, DirEntry, error) {
	parentPath := file.ParentPath()
	dblock, err := fbo.getDirLocked(md, *parentPath, write)
	if err != nil {
		return nil, DirEntry{}, err
	}

	dblock = fbo.updateDirBlock(*parentPath, dblock)

	// make sure it exists
	name := file.TailName()
	de, ok := dblock.Children[name]
	if !ok {
		return nil, DirEntry{}, NoSuchNameError{name}
	}

	return dblock, de, err
}

// Lookup implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) Lookup(ctx context.Context, dir Node, name string) (
	node Node, de DirEntry, err error) {
	err = fbo.checkNode(dir)
	if err != nil {
		return
	}

	md, err := fbo.getMDForReadLocked(read)
	if err != nil {
		return
	}

	fbo.blockLock.RLock()
	defer fbo.blockLock.RUnlock()
	dirPath := fbo.nodeCache.PathFromNode(dir)
	childPath := *dirPath.ChildPathNoPtr(name)
	_, de, err = fbo.getEntryLocked(md, childPath)
	if err != nil {
		return
	}

	if de.Type == Sym {
		node = nil
	} else {
		node, err =
			fbo.nodeCache.GetOrCreate(stripBP(de.BlockPointer), name, dir)
	}
	return
}

// Stat implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) Stat(ctx context.Context, node Node) (
	de DirEntry, err error) {
	err = fbo.checkNode(node)
	if err != nil {
		return
	}

	md, err := fbo.getMDForReadLocked(read)
	if err != nil {
		return
	}

	fbo.blockLock.RLock()
	defer fbo.blockLock.RUnlock()
	nodePath := fbo.nodeCache.PathFromNode(node)
	_, de, err = fbo.getEntryLocked(md, nodePath)
	return
}

var zeroPtr BlockPointer

type blockState struct {
	blockPtr       BlockPointer
	block          Block
	readyBlockData ReadyBlockData
}

// blockPutState is an internal structure to track data when putting blocks
type blockPutState struct {
	oldPtrs     map[BlockPointer]BlockPointer
	blockStates []blockState
}

func newBlockPutState(length int) *blockPutState {
	bps := &blockPutState{}
	bps.oldPtrs = make(map[BlockPointer]BlockPointer)
	bps.blockStates = make([]blockState, 0, length)
	return bps
}

func (bps *blockPutState) addNewBlock(blockPtr BlockPointer, block Block,
	readyBlockData ReadyBlockData) {
	bps.blockStates = append(bps.blockStates,
		blockState{blockPtr, block, readyBlockData})
}

func (bps *blockPutState) mergeOtherBps(other *blockPutState) {
	for k, v := range other.oldPtrs {
		bps.oldPtrs[k] = v
	}
	bps.blockStates = append(bps.blockStates, other.blockStates...)
}

func (fbo *FolderBranchOps) readyBlock(md *RootMetadata, block Block,
	user keybase1.UID) (
	info BlockInfo, plainSize int, readyBlockData ReadyBlockData, err error) {
	id, plainSize, readyBlockData, err := fbo.config.BlockOps().Ready(md, block)
	if err != nil {
		return
	}

	info = BlockInfo{
		BlockPointer: BlockPointer{
			ID:      id,
			KeyGen:  md.LatestKeyGeneration(),
			DataVer: fbo.config.DataVersion(),
			Writer:  user,
			// TODO: for now, the reference nonce for a block is just zero.
			// When we implement de-duping, we should set it to a random nonce
			// for all but the initial reference.
			RefNonce: zeroBlockRefNonce,
		},
		EncodedSize: uint32(readyBlockData.GetEncodedSize()),
	}
	return
}

func (fbo *FolderBranchOps) readyBlockMultiple(md *RootMetadata,
	currBlock Block, user keybase1.UID, bps *blockPutState) (
	info BlockInfo, plainSize int, err error) {
	info, plainSize, readyBlockData, err := fbo.readyBlock(md, currBlock, user)
	if err != nil {
		return
	}

	bps.addNewBlock(info.BlockPointer, currBlock, readyBlockData)
	return
}

func (fbo *FolderBranchOps) unembedBlockChanges(bps *blockPutState,
	md *RootMetadata, changes *BlockChanges, user keybase1.UID) (err error) {
	buf, err := fbo.config.Codec().Encode(changes)
	if err != nil {
		return
	}
	block := NewFileBlock().(*FileBlock)
	block.Contents = buf
	info, _, err := fbo.readyBlockMultiple(md, block, user, bps)
	if err != nil {
		return
	}
	changes.Pointer = info.BlockPointer
	changes.Ops = nil
	md.RefBytes += uint64(info.EncodedSize)
	return
}

// headLock should be taken by the caller.
func (fbo *FolderBranchOps) saveMdToCacheLocked(md *RootMetadata) error {
	mdID, err := md.MetadataID(fbo.config)
	if err != nil {
		return err
	}

	headID, err := fbo.head.MetadataID(fbo.config)
	if err != nil {
		return err
	}

	if headID == mdID {
		// only save this new MD if the MDID has changed
		return nil
	} else if err = fbo.config.MDCache().Put(mdID, md); err != nil {
		return err
	}
	fbo.head = md
	return nil
}

// cacheBlockIfNotYetDirtyLocked puts a block into the cache, but only
// does so if the block isn't already marked as dirty in the cache.
// This is useful when operating on a dirty copy of a block that may
// already be in the cache.
//
// blockLock should be taken by the caller for writing.
func (fbo *FolderBranchOps) cacheBlockIfNotYetDirtyLocked(
	ptr BlockPointer, branch BranchName, block Block) error {
	if !fbo.config.BlockCache().IsDirty(ptr, branch) {
		return fbo.config.BlockCache().PutDirty(ptr, branch, block)
	} else if fbo.copyFileBlocks[ptr] {
		fbo.copyFileBlocks[ptr] = false
		fbo.doDeferWrite = true
		// Overwrite the dirty block if this is a copy-on-write during
		// a sync.  Don't worry, the old dirty block is safe in the
		// sync goroutine (and also probably saved to the cache under
		// its new ID already.
		return fbo.config.BlockCache().PutDirty(ptr, branch, block)
	}
	return nil
}

type localBcache map[BlockPointer]*DirBlock

// TODO: deal with multiple nodes for indirect blocks
//
// entryType must not be Sym.  writerLock must be taken by caller.
func (fbo *FolderBranchOps) syncBlockLocked(md *RootMetadata,
	newBlock Block, dir Path, name string, entryType EntryType,
	mtime bool, ctime bool, stopAt BlockPointer, lbc localBcache) (
	Path, DirEntry, *blockPutState, error) {
	user, err := fbo.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return Path{}, DirEntry{}, nil, err
	}

	// now ready each dblock and write the DirEntry for the next one
	// in the path
	currBlock := newBlock
	currName := name
	newPath := Path{
		TopDir: dir.TopDir,
		Branch: dir.Branch,
		Path:   make([]PathNode, 0, len(dir.Path)),
	}
	bps := newBlockPutState(len(dir.Path))
	refPath := *dir.ChildPathNoPtr(name)
	var newDe DirEntry
	doSetTime := true
	now := time.Now().UnixNano()
	for len(newPath.Path) < len(dir.Path)+1 {
		info, plainSize, err := fbo.readyBlockMultiple(md, currBlock, user, bps)
		if err != nil {
			return Path{}, DirEntry{}, nil, err
		}

		// prepend to path and setup next one
		newPath.Path = append([]PathNode{PathNode{info.BlockPointer, currName}},
			newPath.Path...)

		// get the parent block
		prevIdx := len(dir.Path) - len(newPath.Path)
		var prevDblock *DirBlock
		var de DirEntry
		var nextName string
		nextDoSetTime := false
		if prevIdx < 0 {
			// root dir, update the MD instead
			de = md.data.Dir
			// no need to take headLock here, since we already have
			// writerLock; no one else will be modifying the MD.
			md.PrevRoot, err = fbo.head.MetadataID(fbo.config)
			if err != nil {
				return Path{}, DirEntry{}, nil, err
			}
		} else {
			prevDir := Path{
				TopDir: dir.TopDir,
				Branch: dir.Branch,
				Path:   dir.Path[:prevIdx+1],
			}

			// first, check the localBcache, which could contain
			// blocks that were modified across multiple calls to
			// syncBlockLocked.
			var ok bool
			prevDblock, ok = lbc[prevDir.TailPointer()]
			if !ok {
				// If the block isn't in the local bcache, we have to
				// fetch it, possibly from the network.  Take
				// blockLock to make this safe, but we don't need to
				// hold it throughout the entire syncBlock execution
				// because we are only fetching directory blocks.
				// Directory blocks are only ever modified while
				// holding writerLock, so it's safe to release the
				// blockLock in between fetches.
				fbo.blockLock.RLock()
				prevDblock, err = fbo.getDirLocked(md, prevDir, write)
				if err != nil {
					fbo.blockLock.RUnlock()
					return Path{}, DirEntry{}, nil, err
				}
				fbo.blockLock.RUnlock()
			}

			// modify the direntry for currName; make one
			// if it doesn't exist (which should only
			// happen the first time around).
			//
			// TODO: Pull the creation out of here and
			// into createEntryLocked().
			if de, ok = prevDblock.Children[currName]; !ok {
				// If this isn't the first time
				// around, we have an error.
				if len(newPath.Path) > 1 {
					return Path{}, DirEntry{}, nil, NoSuchNameError{currName}
				}

				// If this is a file, the size should be 0. (TODO:
				// Ensure this.) If this is a directory, the size will
				// be filled in below.  The times will be filled in
				// below as well, since we should only be creating a
				// new directory entry when doSetTime is true.
				de = DirEntry{
					Type: entryType,
					Size: 0,
				}
				// If we're creating a new directory entry, the
				// parent's times must be set as well.
				nextDoSetTime = true
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
			md.AddUpdate(md.data.Dir.BlockInfo, info)
			bps.oldPtrs[info.BlockPointer] = md.data.Dir.BlockPointer
		} else if prevDe, ok := prevDblock.Children[currName]; ok {
			md.AddUpdate(prevDe.BlockInfo, info)
			bps.oldPtrs[info.BlockPointer] = prevDe.BlockPointer
		} else {
			// this is a new block
			md.AddRefBlock(info)
		}

		if len(refPath.Path) > 1 {
			refPath = *refPath.ParentPath()
		}
		de.BlockInfo = info

		if doSetTime {
			if mtime {
				de.Mtime = now
			}
			if ctime {
				de.Ctime = now
			}
		}
		if !newDe.IsInitialized() {
			newDe = de
		}

		if prevIdx < 0 {
			md.data.Dir = de
		} else {
			prevDblock.Children[currName] = de
		}
		currName = nextName

		// Stop before we get to the common ancestor; it will be taken care of
		// on the next sync call
		if prevIdx >= 0 && dir.Path[prevIdx].BlockPointer == stopAt {
			// Put this back into the cache as dirty -- the next
			// syncBlock call will ready it.
			dblock, ok := currBlock.(*DirBlock)
			if !ok {
				return Path{}, DirEntry{}, nil, BadDataError{stopAt.ID}
			}
			lbc[stopAt] = dblock
			break
		}
		doSetTime = nextDoSetTime
	}

	// do the block changes need their own blocks?
	bsplit := fbo.config.BlockSplitter()
	if !bsplit.ShouldEmbedBlockChanges(&md.data.Changes) {
		err = fbo.unembedBlockChanges(bps, md, &md.data.Changes,
			user)
		if err != nil {
			return Path{}, DirEntry{}, nil, err
		}
	}

	// now write all the dirblocks to the cache and server
	// TODO: parallelize me
	bops := fbo.config.BlockOps()
	for _, blockState := range bps.blockStates {
		if err = bops.Put(md, blockState.blockPtr,
			blockState.readyBlockData); err != nil {
			return Path{}, DirEntry{}, nil, err
		}
	}

	return newPath, newDe, bps, nil
}

// both writerLock and blockLocked should be taken by the caller
func (fbo *FolderBranchOps) finalizeBlocksLocked(bps *blockPutState,
	newPaths []Path) error {
	bcache := fbo.config.BlockCache()
	fbo.cacheLock.Lock()
	defer fbo.cacheLock.Unlock()
	for _, blockState := range bps.blockStates {
		newPtr := blockState.blockPtr
		if oldPtr, ok := bps.oldPtrs[newPtr]; ok {
			// move the deCache for this directory
			oldPtrStripped := stripBP(oldPtr)
			if deMap, ok := fbo.deCache[oldPtrStripped]; ok {
				fbo.deCache[stripBP(blockState.blockPtr)] = deMap
				delete(fbo.deCache, oldPtrStripped)
			}
		}
		if err := bcache.Put(newPtr.ID, blockState.block); err != nil {
			return err
		}
	}
	for newPtr, oldPtr := range bps.oldPtrs {
		fbo.nodeCache.UpdatePointer(stripBP(oldPtr), stripBP(newPtr))
	}
	return nil
}

// writerLock must be taken by the caller.
func (fbo *FolderBranchOps) finalizeWriteLocked(ctx context.Context,
	md *RootMetadata, bps *blockPutState, newPaths []Path) error {
	if len(newPaths) == 0 {
		return fmt.Errorf("Can't finalize 0 paths")
	}

	user, err := fbo.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return err
	}

	// finally, write out the new metadata
	md.data.LastWriter = user
	if err = fbo.config.MDOps().Put(
		newPaths[0].TopDir, md, nil, NullMdID); err != nil {
		return err
	}
	// TODO: PutUnmerged if necessary

	fbo.headLock.Lock()
	defer fbo.headLock.Unlock()

	// now take the blockLock, since we are potentially finalizing and
	// messing with old blocks
	fbo.blockLock.Lock()
	err = fbo.finalizeBlocksLocked(bps, newPaths)
	fbo.blockLock.Unlock()
	if err != nil {
		return err
	}

	err = fbo.saveMdToCacheLocked(md)
	if err != nil {
		// XXX: if we return with an error here, should we somehow
		// roll back the nodeCache BlockPointer updates that happened
		// in finalizeBlocksLocked()?
		return err
	}

	fbo.notifyBatch(ctx, newPaths[0].TopDir, newPaths)
	return nil
}

// writerLock must be taken by the caller, but not blockLock
func (fbo *FolderBranchOps) syncBlockAndFinalizeLocked(ctx context.Context,
	md *RootMetadata, newBlock Block, dir Path, name string,
	entryType EntryType, mtime bool, ctime bool, stopAt BlockPointer) (
	DirEntry, error) {
	p, de, bps, err := fbo.syncBlockLocked(md, newBlock, dir, name, entryType,
		mtime, ctime, zeroPtr, nil)
	if err != nil {
		return DirEntry{}, err
	}
	err = fbo.finalizeWriteLocked(ctx, md, bps, []Path{p})
	if err != nil {
		return DirEntry{}, err
	}
	return de, nil
}

// entryType must not by Sym.  writerLock must be taken by caller.
func (fbo *FolderBranchOps) createEntryLocked(
	ctx context.Context, dir Node, name string, entryType EntryType) (
	Node, DirEntry, error) {
	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked()
	if err != nil {
		return nil, DirEntry{}, err
	}

	fbo.blockLock.RLock()
	dirPath := fbo.nodeCache.PathFromNode(dir)
	dblock, err := fbo.getDirLocked(md, dirPath, write)
	if err != nil {
		fbo.blockLock.RUnlock()
		return nil, DirEntry{}, err
	}
	fbo.blockLock.RUnlock()

	// does name already exist?
	if _, ok := dblock.Children[name]; ok {
		return nil, DirEntry{}, NameExistsError{name}
	}

	md.AddOp(newCreateOp(name, stripBP(dirPath.TailPointer())))
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

	de, err := fbo.syncBlockAndFinalizeLocked(ctx, md, newBlock, dirPath, name,
		entryType, true, true, zeroPtr)
	if err != nil {
		return nil, DirEntry{}, err
	}
	node, err := fbo.nodeCache.GetOrCreate(stripBP(de.BlockPointer), name, dir)
	if err != nil {
		return nil, DirEntry{}, err
	}
	return node, de, nil
}

// CreateDir implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) CreateDir(
	ctx context.Context, dir Node, path string) (Node, DirEntry, error) {
	err := fbo.checkNode(dir)
	if err != nil {
		return nil, DirEntry{}, err
	}

	fbo.writerLock.Lock()
	defer fbo.writerLock.Unlock()
	return fbo.createEntryLocked(ctx, dir, path, Dir)
}

// CreateFile implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) CreateFile(
	ctx context.Context, dir Node, path string, isExec bool) (
	n Node, de DirEntry, err error) {
	err = fbo.checkNode(dir)
	if err != nil {
		return
	}

	var entryType EntryType
	if isExec {
		entryType = Exec
	} else {
		entryType = File
	}

	fbo.writerLock.Lock()
	defer fbo.writerLock.Unlock()
	return fbo.createEntryLocked(ctx, dir, path, entryType)
}

// writerLock must be taken by caller.
func (fbo *FolderBranchOps) createLinkLocked(
	ctx context.Context, dir Node, fromName string, toPath string) (
	DirEntry, error) {
	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked()
	if err != nil {
		return DirEntry{}, err
	}

	fbo.blockLock.RLock()
	dirPath := fbo.nodeCache.PathFromNode(dir)
	dblock, err := fbo.getDirLocked(md, dirPath, write)
	if err != nil {
		fbo.blockLock.RUnlock()
		return DirEntry{}, err
	}
	fbo.blockLock.RUnlock()

	// TODO: validate inputs

	// does name already exist?
	if _, ok := dblock.Children[fromName]; ok {
		return DirEntry{}, NameExistsError{fromName}
	}

	md.AddOp(newCreateOp(fromName, stripBP(dirPath.TailPointer())))

	// Create a direntry for the link, and then sync
	dblock.Children[fromName] = DirEntry{
		Type:    Sym,
		Size:    uint64(len(toPath)),
		SymPath: toPath,
		Mtime:   time.Now().UnixNano(),
		Ctime:   time.Now().UnixNano(),
	}

	_, err = fbo.syncBlockAndFinalizeLocked(
		ctx, md, dblock, *dirPath.ParentPath(), dirPath.TailName(), Dir,
		true, true, zeroPtr)
	if err != nil {
		return DirEntry{}, err
	}
	return dblock.Children[fromName], nil
}

// CreateLink implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) CreateLink(
	ctx context.Context, dir Node, fromName string, toPath string) (
	DirEntry, error) {
	err := fbo.checkNode(dir)
	if err != nil {
		return DirEntry{}, err
	}

	fbo.writerLock.Lock()
	defer fbo.writerLock.Unlock()
	return fbo.createLinkLocked(ctx, dir, fromName, toPath)
}

// writerLock must be taken by caller.
func (fbo *FolderBranchOps) removeEntryLocked(ctx context.Context,
	md *RootMetadata, dir Path, name string) error {
	fbo.blockLock.RLock()
	pblock, err := fbo.getDirLocked(md, dir, write)
	if err != nil {
		fbo.blockLock.RUnlock()
		return err
	}
	fbo.blockLock.RUnlock()

	// make sure the entry exists
	de, ok := pblock.Children[name]
	if !ok {
		return NoSuchNameError{name}
	}

	md.AddOp(newRmOp(name, stripBP(dir.TailPointer())))
	md.AddUnrefBlock(de.BlockInfo)
	// construct a path for the child so we can unlink with it.
	childPath := *dir.ChildPathNoPtr(name)
	childPath.Path[len(childPath.Path)-1].BlockPointer = de.BlockPointer

	// If this is an indirect block, we need to delete all of its
	// children as well. (TODO: handle multiple levels of
	// indirection.)  NOTE: non-empty directories can't be removed, so
	// no need to check for indirect directory blocks here.
	if de.Type == File || de.Type == Exec {
		block, err := fbo.getBlockLocked(md, childPath, NewFileBlock, write)
		if err != nil {
			return NoSuchBlockError{de.ID}
		}
		fBlock, ok := block.(*FileBlock)
		if !ok {
			return &NotFileError{dir}
		}
		if fBlock.IsInd {
			for _, ptr := range fBlock.IPtrs {
				md.AddUnrefBlock(ptr.BlockInfo)
			}
		}
	}

	// the actual unlink
	delete(pblock.Children, name)

	// sync the parent directory
	_, err = fbo.syncBlockAndFinalizeLocked(
		ctx, md, pblock, *dir.ParentPath(), dir.TailName(),
		Dir, true, true, zeroPtr)
	if err != nil {
		return err
	}
	fbo.nodeCache.Unlink(stripBP(de.BlockPointer), childPath)
	return nil
}

// RemoveDir implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) RemoveDir(
	ctx context.Context, dir Node, dirName string) (err error) {
	err = fbo.checkNode(dir)
	if err != nil {
		return
	}

	fbo.writerLock.Lock()
	defer fbo.writerLock.Unlock()

	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked()
	if err != nil {
		return err
	}

	dirPath := fbo.nodeCache.PathFromNode(dir)
	err = func() error {
		fbo.blockLock.RLock()
		defer fbo.blockLock.RUnlock()
		pblock, err := fbo.getDirLocked(md, dirPath, read)
		de, ok := pblock.Children[dirName]
		if !ok {
			return NoSuchNameError{dirName}
		}

		// construct a path for the child so we can check for an empty dir
		childPath := *dirPath.ChildPathNoPtr(dirName)
		childPath.Path[len(childPath.Path)-1].BlockPointer = de.BlockPointer

		childBlock, err := fbo.getDirLocked(md, childPath, read)
		if err != nil {
			return err
		}

		if len(childBlock.Children) > 0 {
			return DirNotEmptyError{dirName}
		}
		return nil
	}()
	if err != nil {
		return err
	}

	return fbo.removeEntryLocked(ctx, md, dirPath, dirName)
}

// RemoveEntry implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) RemoveEntry(ctx context.Context, dir Node,
	name string) error {
	err := fbo.checkNode(dir)
	if err != nil {
		return err
	}

	fbo.writerLock.Lock()
	defer fbo.writerLock.Unlock()

	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked()
	if err != nil {
		return err
	}

	dirPath := fbo.nodeCache.PathFromNode(dir)
	return fbo.removeEntryLocked(ctx, md, dirPath, name)
}

// writerLock must be taken by caller.
func (fbo *FolderBranchOps) renameLocked(
	ctx context.Context, oldParent Path, oldName string, newParent Path,
	newName string, newParentNode Node) error {
	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked()
	if err != nil {
		return err
	}

	doUnlock := true
	fbo.blockLock.RLock()
	defer func() {
		if doUnlock {
			fbo.blockLock.RUnlock()
		}
	}()

	// look up in the old path
	oldPBlock, err := fbo.getDirLocked(md, oldParent, write)
	if err != nil {
		return err
	}
	// does name exist?
	if _, ok := oldPBlock.Children[oldName]; !ok {
		return NoSuchNameError{oldName}
	}

	md.AddOp(newRenameOp(oldName, stripBP(oldParent.TailPointer()),
		newName, stripBP(newParent.TailPointer())))

	lbc := make(localBcache)
	// look up in the old path
	var newPBlock *DirBlock
	// TODO: Write a SameBlock() function that can deal properly with
	// dedup'd blocks that share an ID but can be updated separately.
	if oldParent.TailPointer().ID == newParent.TailPointer().ID {
		newPBlock = oldPBlock
	} else {
		newPBlock, err = fbo.getDirLocked(md, newParent, write)
		if err != nil {
			return err
		}
		now := time.Now().UnixNano()

		oldGrandparent := *oldParent.ParentPath()
		if len(oldGrandparent.Path) > 0 {
			// Update the old parent's mtime/ctime, unless the
			// oldGrandparent is the same as newParent (in which case, the
			// syncBlockLocked call will take care of it).
			if oldGrandparent.TailPointer().ID != newParent.TailPointer().ID {
				b, err := fbo.getDirLocked(md, oldGrandparent, write)
				if err != nil {
					return err
				}
				if de, ok := b.Children[oldParent.TailName()]; ok {
					de.Ctime = now
					de.Mtime = now
					b.Children[oldParent.TailName()] = de
					// Put this block back into the local cache as dirty
					lbc[oldGrandparent.TailPointer()] = b
				}
			}
		} else {
			md.data.Dir.Ctime = now
			md.data.Dir.Mtime = now
		}
	}
	doUnlock = false
	fbo.blockLock.RUnlock()

	// does name exist?
	if _, ok := newPBlock.Children[newName]; ok {
		// TODO: delete the old block pointed to by this direntry
	}

	newDe := oldPBlock.Children[oldName]
	// only the ctime changes
	newDe.Ctime = time.Now().UnixNano()
	newPBlock.Children[newName] = newDe
	delete(oldPBlock.Children, oldName)

	// if there are any outstanding de updates from writes/truncates
	// for the moved path, we need to move them too
	if oldParent.TailPointer().ID != newParent.TailPointer().ID {
		fbo.cacheLock.Lock()
		oldPtr := stripBP(oldParent.TailPointer())
		if deMap, ok := fbo.deCache[oldPtr]; ok {
			dePtr := stripBP(newDe.BlockPointer)
			if de, ok := deMap[dePtr]; ok {
				newPtr := stripBP(newParent.TailPointer())
				if _, ok = fbo.deCache[newPtr]; !ok {
					fbo.deCache[newPtr] = make(map[BlockPointer]DirEntry)
				}
				fbo.deCache[newPtr][dePtr] = de
				delete(deMap, dePtr)
				if deMap == nil {
					delete(fbo.deCache, oldPtr)
				} else {
					fbo.deCache[oldPtr] = deMap
				}
			}
		}
		fbo.cacheLock.Unlock()
	}

	// find the common ancestor
	var i int
	found := false
	// the root block will always be the same, so start at number 1
	for i = 1; i < len(oldParent.Path) && i < len(newParent.Path); i++ {
		if oldParent.Path[i].ID != newParent.Path[i].ID {
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
	commonAncestor := oldParent.Path[i].BlockPointer
	oldIsCommon := oldParent.TailPointer() == commonAncestor
	newIsCommon := newParent.TailPointer() == commonAncestor

	newOldPath := Path{TopDir: oldParent.TopDir}
	var oldBps *blockPutState
	if oldIsCommon {
		if newIsCommon {
			// if old and new are both the common ancestor, there is
			// nothing to do (syncBlock will take care of everything)
		} else {
			// If the old one is common and the new one is not, then
			// the last syncBlockLocked call will need to access
			// the old one.
			lbc[oldParent.TailPointer()] = oldPBlock
		}
	} else {
		if newIsCommon {
			// If the new one is common, then the first
			// syncBlockLocked call will need to access it.
			lbc[newParent.TailPointer()] = newPBlock
		}

		// The old one is not the common ancestor, so we need to sync it.
		// TODO: optimize by pushing blocks from both paths in parallel
		newOldPath, _, oldBps, err = fbo.syncBlockLocked(
			md, oldPBlock, *oldParent.ParentPath(), oldParent.TailName(),
			Dir, true, true, commonAncestor, lbc)
		if err != nil {
			return err
		}
	}

	newNewPath, _, newBps, err := fbo.syncBlockLocked(
		md, newPBlock, *newParent.ParentPath(), newParent.TailName(),
		Dir, true, true, zeroPtr, lbc)
	if err != nil {
		return err
	}

	// newOldPath is really just a prefix now.  A copy is necessary as an
	// append could cause the new path to contain nodes from the old path.
	newOldPath.Path = append(make([]PathNode, i+1, i+1), newOldPath.Path...)
	copy(newOldPath.Path[:i+1], newNewPath.Path[:i+1])

	// merge and finalize the blockPutStates
	if oldBps != nil {
		newBps.mergeOtherBps(oldBps)
	}
	err = fbo.nodeCache.Move(stripBP(newDe.BlockPointer),
		newParentNode, newName)
	if err != nil {
		return err
	}
	return fbo.finalizeWriteLocked(
		ctx, md, newBps, []Path{newOldPath, newNewPath})
}

// Rename implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) Rename(
	ctx context.Context, oldParent Node, oldName string, newParent Node,
	newName string) error {
	err := fbo.checkNode(newParent)
	if err != nil {
		return err
	}

	fbo.writerLock.Lock()
	defer fbo.writerLock.Unlock()

	oldParentPath := fbo.nodeCache.PathFromNode(oldParent)
	newParentPath := fbo.nodeCache.PathFromNode(newParent)

	// only works for paths within the same topdir
	if (oldParentPath.TopDir != newParentPath.TopDir) ||
		(oldParentPath.Branch != newParentPath.Branch) ||
		(oldParentPath.Path[0].ID != newParentPath.Path[0].ID) {
		return RenameAcrossDirsError{}
	}

	return fbo.renameLocked(ctx, oldParentPath, oldName, newParentPath,
		newName, newParent)
}

// blockLock must be taken for reading by caller.
func (fbo *FolderBranchOps) getFileBlockAtOffsetLocked(
	md *RootMetadata, file Path, topBlock *FileBlock, off int64,
	rtype reqType) (ptr BlockPointer, parentBlock *FileBlock, indexInParent int,
	block *FileBlock, more bool, startOff int64, err error) {
	// find the block matching the offset, if it exists
	ptr = file.TailPointer()
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
		ptr = nextPtr.BlockPointer
		newPath.Path = append(newPath.Path, PathNode{
			nextPtr.BlockPointer, file.TailName(),
		})
		if block, err = fbo.getFileLocked(md, newPath, rtype); err != nil {
			return
		}
	}

	return
}

// blockLock must be taken for reading by the caller
func (fbo *FolderBranchOps) readLocked(file Path, dest []byte, off int64) (
	int64, error) {
	// verify we have permission to read
	md, err := fbo.getMDForReadLocked(read)
	if err != nil {
		return 0, err
	}

	// getFileLocked already checks read permissions
	fblock, err := fbo.getFileLocked(md, file, read)
	if err != nil {
		return 0, err
	}

	nRead := int64(0)
	n := int64(len(dest))

	for nRead < n {
		nextByte := nRead + off
		toRead := n - nRead
		_, _, _, block, _, startOff, err :=
			fbo.getFileBlockAtOffsetLocked(md, file, fblock, nextByte, read)
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

// Read implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) Read(
	ctx context.Context, file Node, dest []byte, off int64) (int64, error) {
	err := fbo.checkNode(file)
	if err != nil {
		return 0, err
	}

	fbo.blockLock.RLock()
	defer fbo.blockLock.RUnlock()
	filePath := fbo.nodeCache.PathFromNode(file)
	return fbo.readLocked(filePath, dest, off)
}

// blockLock must be taken by the caller.
func (fbo *FolderBranchOps) newRightBlockLocked(
	ptr BlockPointer, branch BranchName, pblock *FileBlock,
	off int64, md *RootMetadata) error {
	newRID, err := fbo.config.Crypto().MakeTemporaryBlockID()
	if err != nil {
		return err
	}
	user, err := fbo.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return err
	}
	rblock := &FileBlock{
		CommonBlock: CommonBlock{
			Seed: rand.Int63(),
		},
	}

	pblock.IPtrs = append(pblock.IPtrs, IndirectFilePtr{
		BlockInfo: BlockInfo{
			BlockPointer: BlockPointer{
				ID:       newRID,
				KeyGen:   md.LatestKeyGeneration(),
				DataVer:  fbo.config.DataVersion(),
				Writer:   user,
				RefNonce: zeroBlockRefNonce,
			},
			EncodedSize: 0,
		},
		Off: off,
	})

	if err := fbo.config.BlockCache().PutDirty(
		pblock.IPtrs[len(pblock.IPtrs)-1].BlockPointer,
		branch, rblock); err != nil {
		return err
	}

	if err = fbo.cacheBlockIfNotYetDirtyLocked(
		ptr, branch, pblock); err != nil {
		return err
	}
	return nil
}

// cacheLock must be taken by the caller
func (fbo *FolderBranchOps) getOrCreateSyncInfoLocked(de DirEntry) *syncInfo {
	ptr := stripBP(de.BlockPointer)
	si, ok := fbo.unrefCache[ptr]
	if !ok {
		si = &syncInfo{
			oldInfo: de.BlockInfo,
			op:      newSyncOp(ptr),
		}
		fbo.unrefCache[ptr] = si
	}
	return si
}

// blockLock must be taken for writing by the caller.
func (fbo *FolderBranchOps) writeDataLocked(
	ctx context.Context, md *RootMetadata, file Path, data []byte,
	off int64, doNotify bool) error {
	// check writer status explicitly
	user, err := fbo.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return err
	}
	if !md.GetDirHandle().IsWriter(user) {
		return NewWriteAccessError(fbo.config, md.GetDirHandle(), user)
	}

	fblock, err := fbo.getFileLocked(md, file, write)
	if err != nil {
		return err
	}

	bcache := fbo.config.BlockCache()
	bsplit := fbo.config.BlockSplitter()
	n := int64(len(data))
	nCopied := int64(0)

	_, de, err := fbo.getEntryLocked(md, file)
	if err != nil {
		return err
	}

	fbo.cacheLock.Lock()
	defer fbo.cacheLock.Unlock()
	si := fbo.getOrCreateSyncInfoLocked(de)
	for nCopied < n {
		ptr, parentBlock, indexInParent, block, more, startOff, err :=
			fbo.getFileBlockAtOffsetLocked(md, file, fblock, off+nCopied, write)
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
			return BadSplitError{}
		}

		// TODO: support multiple levels of indirection.  Right now the
		// code only does one but it should be straightforward to
		// generalize, just annoying

		// if we need another block but there are no more, then make one
		if nCopied < n && !more {
			// If the block doesn't already have a parent block, make one.
			if ptr == file.TailPointer() {
				// pick a new id for this block, and use this block's ID for
				// the parent
				newID, err := fbo.config.Crypto().MakeTemporaryBlockID()
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
							BlockInfo: BlockInfo{
								BlockPointer: BlockPointer{
									ID:       newID,
									KeyGen:   md.LatestKeyGeneration(),
									DataVer:  fbo.config.DataVersion(),
									Writer:   user,
									RefNonce: zeroBlockRefNonce,
								},
								EncodedSize: 0,
							},
							Off: 0,
						},
					},
				}
				if err := bcache.PutDirty(
					file.TailPointer(), file.Branch, fblock); err != nil {
					return err
				}
				ptr = fblock.IPtrs[0].BlockPointer
			}

			// Make a new right block and update the parent's
			// indirect block list
			if err := fbo.newRightBlockLocked(file.TailPointer(),
				file.Branch, fblock,
				startOff+int64(len(block.Contents)), md); err != nil {
				return err
			}
		}

		if oldLen != len(block.Contents) || de.Writer != user {
			de.EncodedSize = 0
			// update the file info
			de.Size += uint64(len(block.Contents) - oldLen)
			de.Writer = user
			parentPtr := stripBP(file.ParentPath().TailPointer())
			if _, ok := fbo.deCache[parentPtr]; !ok {
				fbo.deCache[parentPtr] = make(map[BlockPointer]DirEntry)
			}
			fbo.deCache[parentPtr][stripBP(file.TailPointer())] = de
		}

		if parentBlock != nil {
			// remember how many bytes it was
			si.unrefs = append(si.unrefs,
				parentBlock.IPtrs[indexInParent].BlockInfo)
			parentBlock.IPtrs[indexInParent].EncodedSize = 0
		}
		// keep the old block ID while it's dirty
		if err = fbo.cacheBlockIfNotYetDirtyLocked(ptr, file.Branch,
			block); err != nil {
			return err
		}
	}

	if fblock.IsInd {
		// Always make the top block dirty, so we will sync its
		// indirect blocks.  This has the added benefit of ensuring
		// that any write to a file while it's being sync'd will be
		// deferred, even if it's to a block that's not currently
		// being sync'd, since this top-most block will always be in
		// the copyFileBlocks set.
		if err = fbo.cacheBlockIfNotYetDirtyLocked(
			file.TailPointer(), file.Branch, fblock); err != nil {
			return err
		}
	}
	si.op.addWrite(uint64(off), uint64(len(data)))

	if doNotify {
		fbo.notifyLocal(ctx, file)
	}
	return nil
}

// Write implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) Write(
	ctx context.Context, file Node, data []byte, off int64) error {
	err := fbo.checkNode(file)
	if err != nil {
		return err
	}

	// Get the MD for reading.  We won't modify it; we'll track the
	// unref changes on the side, and put them into the MD during the
	// sync.
	md, err := fbo.getMDLocked(read)
	if err != nil {
		return err
	}

	fbo.blockLock.Lock()
	defer fbo.blockLock.Unlock()
	filePath := fbo.nodeCache.PathFromNode(file)
	fbo.blockWriteLocked = true
	defer func() {
		fbo.blockWriteLocked = false
		fbo.doDeferWrite = false
	}()

	err = fbo.writeDataLocked(ctx, md, filePath, data, off, true)
	if err != nil {
		return err
	}

	if fbo.doDeferWrite {
		// There's an ongoing sync, and this write altered dirty
		// blocks that are in the process of syncing.  So, we have to
		// redo this write once the sync is complete, using the new
		// file path.
		//
		// There is probably a less terrible of doing this that
		// doesn't involve so much copying and rewriting, but this is
		// the most obviously correct way.
		dataCopy := make([]byte, len(data))
		copy(dataCopy, data)
		fbo.deferredWrites = append(fbo.deferredWrites,
			func(ctx context.Context, rmd *RootMetadata, f Path) error {
				return fbo.writeDataLocked(
					ctx, md, f, dataCopy, off, false)
			})
	}

	return nil
}

// blockLocked must be held for writing by the caller
func (fbo *FolderBranchOps) truncateLocked(
	ctx context.Context, md *RootMetadata, file Path, size uint64,
	doNotify bool) error {
	// check writer status explicitly
	user, err := fbo.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return err
	}
	if !md.GetDirHandle().IsWriter(user) {
		return NewWriteAccessError(fbo.config, md.GetDirHandle(), user)
	}

	fblock, err := fbo.getFileLocked(md, file, write)
	if err != nil {
		return err
	}

	// find the block where the file should now end
	iSize := int64(size) // TODO: deal with overflow
	ptr, parentBlock, indexInParent, block, more, startOff, err :=
		fbo.getFileBlockAtOffsetLocked(md, file, fblock, iSize, write)

	currLen := int64(startOff) + int64(len(block.Contents))
	if currLen < iSize {
		// if we need to extend the file, let's just do a write
		moreNeeded := iSize - currLen
		return fbo.writeDataLocked(ctx, md, file, make([]byte, moreNeeded,
			moreNeeded), currLen, doNotify)
	} else if currLen == iSize {
		// same size!
		return nil
	}

	// update the local entry size
	_, de, err := fbo.getEntryLocked(md, file)
	if err != nil {
		return err
	}

	// otherwise, we need to delete some data (and possibly entire blocks)
	block.Contents = append([]byte(nil), block.Contents[:iSize-startOff]...)
	fbo.cacheLock.Lock()
	doCacheUnlock := true
	defer func() {
		if doCacheUnlock {
			fbo.cacheLock.Unlock()
		}
	}()

	si := fbo.getOrCreateSyncInfoLocked(de)
	if more {
		// TODO: if indexInParent == 0, we can remove the level of indirection
		for _, ptr := range parentBlock.IPtrs[indexInParent+1:] {
			si.unrefs = append(si.unrefs, ptr.BlockInfo)
		}
		parentBlock.IPtrs = parentBlock.IPtrs[:indexInParent+1]
		// always make the parent block dirty, so we will sync it
		if err = fbo.cacheBlockIfNotYetDirtyLocked(
			file.TailPointer(), file.Branch, parentBlock); err != nil {
			return err
		}
	}

	if fblock.IsInd {
		// Always make the top block dirty, so we will sync its
		// indirect blocks.  This has the added benefit of ensuring
		// that any truncate to a file while it's being sync'd will be
		// deferred, even if it's to a block that's not currently
		// being sync'd, since this top-most block will always be in
		// the copyFileBlocks set.
		if err = fbo.cacheBlockIfNotYetDirtyLocked(
			file.TailPointer(), file.Branch, fblock); err != nil {
			return err
		}
	}

	if parentBlock != nil {
		// TODO: When we implement more than one level of indirection,
		// make sure that the pointer to parentBlock in the grandparent block
		// has EncodedSize 0.
		si.unrefs = append(si.unrefs,
			parentBlock.IPtrs[indexInParent].BlockInfo)
		parentBlock.IPtrs[indexInParent].EncodedSize = 0
	}

	doCacheUnlock = false
	si.op.addTruncate(size)
	fbo.cacheLock.Unlock()

	de.EncodedSize = 0
	de.Size = size
	de.Writer = user
	parentPtr := stripBP(file.ParentPath().TailPointer())
	if _, ok := fbo.deCache[parentPtr]; !ok {
		fbo.deCache[parentPtr] = make(map[BlockPointer]DirEntry)
	}
	fbo.deCache[parentPtr][stripBP(file.TailPointer())] = de

	// Keep the old block ID while it's dirty.
	if err = fbo.cacheBlockIfNotYetDirtyLocked(
		ptr, file.Branch, block); err != nil {
		return err
	}

	if doNotify {
		fbo.notifyLocal(ctx, file)
	}
	return nil
}

// Truncate implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) Truncate(
	ctx context.Context, file Node, size uint64) error {
	err := fbo.checkNode(file)
	if err != nil {
		return err
	}

	// Get the MD for reading.  We won't modify it; we'll track the
	// unref changes on the side, and put them into the MD during the
	// sync.
	md, err := fbo.getMDLocked(read)
	if err != nil {
		return err
	}

	fbo.blockLock.Lock()
	defer fbo.blockLock.Unlock()
	filePath := fbo.nodeCache.PathFromNode(file)
	fbo.blockWriteLocked = true
	defer func() {
		fbo.blockWriteLocked = false
		fbo.doDeferWrite = false
	}()

	err = fbo.truncateLocked(ctx, md, filePath, size, true)
	if err != nil {
		return err
	}

	if fbo.doDeferWrite {
		// There's an ongoing sync, and this truncate altered
		// dirty blocks that are in the process of syncing.  So,
		// we have to redo this truncate once the sync is complete,
		// using the new file path.
		fbo.deferredWrites = append(fbo.deferredWrites,
			func(ctx context.Context, rmd *RootMetadata, f Path) error {
				return fbo.truncateLocked(ctx, md, f, size, false)
			})
	}
	return nil
}

// writerLock must be taken by caller.
func (fbo *FolderBranchOps) setExLocked(
	ctx context.Context, file Path, ex bool) (err error) {
	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked()
	if err != nil {
		return
	}

	fbo.blockLock.RLock()
	dblock, de, err := fbo.getEntryLocked(md, file)
	if err != nil {
		fbo.blockLock.RUnlock()
		return
	}
	fbo.blockLock.RUnlock()

	// If the file is a symlink, do nothing (to match ext4
	// behavior).
	if de.Type == Sym {
		return
	}

	if ex && (de.Type == File) {
		de.Type = Exec
	} else if !ex && (de.Type == Exec) {
		de.Type = File
	}

	parentPath := file.ParentPath()
	md.AddOp(newSetAttrOp(file.TailName(), stripBP(parentPath.TailPointer())))

	// If the type isn't File or Exec, there's nothing to do, but
	// change the ctime anyway (to match ext4 behavior).
	de.Ctime = time.Now().UnixNano()
	dblock.Children[file.TailName()] = de
	_, err = fbo.syncBlockAndFinalizeLocked(
		ctx, md, dblock, *parentPath.ParentPath(), parentPath.TailName(),
		Dir, false, false, zeroPtr)
	return err
}

// SetEx implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) SetEx(
	ctx context.Context, file Node, ex bool) (err error) {
	err = fbo.checkNode(file)
	if err != nil {
		return
	}

	fbo.writerLock.Lock()
	defer fbo.writerLock.Unlock()
	filePath := fbo.nodeCache.PathFromNode(file)
	return fbo.setExLocked(ctx, filePath, ex)
}

// writerLock must be taken by caller.
func (fbo *FolderBranchOps) setMtimeLocked(
	ctx context.Context, file Path, mtime *time.Time) error {
	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked()
	if err != nil {
		return err
	}

	fbo.blockLock.RLock()
	dblock, de, err := fbo.getEntryLocked(md, file)
	if err != nil {
		fbo.blockLock.RUnlock()
		return err
	}
	fbo.blockLock.RUnlock()

	parentPath := file.ParentPath()
	md.AddOp(newSetAttrOp(file.TailName(), stripBP(parentPath.TailPointer())))

	de.Mtime = mtime.UnixNano()
	// setting the mtime counts as changing the file MD, so must set ctime too
	de.Ctime = time.Now().UnixNano()
	dblock.Children[file.TailName()] = de
	_, err = fbo.syncBlockAndFinalizeLocked(
		ctx, md, dblock, *parentPath.ParentPath(), parentPath.TailName(),
		Dir, false, false, zeroPtr)
	return err
}

// SetMtime implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) SetMtime(
	ctx context.Context, file Node, mtime *time.Time) (err error) {
	if mtime == nil {
		// Can happen on some OSes (e.g. OSX) when trying to set the atime only
		return nil
	}

	err = fbo.checkNode(file)
	if err != nil {
		return
	}

	fbo.writerLock.Lock()
	defer fbo.writerLock.Unlock()
	filePath := fbo.nodeCache.PathFromNode(file)
	return fbo.setMtimeLocked(ctx, filePath, mtime)
}

// cacheLock should be taken by the caller
func (fbo *FolderBranchOps) mergeUnrefCacheLocked(file Path, md *RootMetadata) {
	filePtr := stripBP(file.TailPointer())
	for _, info := range fbo.unrefCache[filePtr].unrefs {
		// it's ok if we push the same ptr.ID/RefNonce multiple times,
		// because the subsequent ones should have a QuotaSize of 0.
		md.AddUnrefBlock(info)
	}
	delete(fbo.unrefCache, filePtr)
}

// writerLock must be taken by the caller.
func (fbo *FolderBranchOps) syncLocked(ctx context.Context, file Path) error {
	// if the cache for this file isn't dirty, we're done
	fbo.blockLock.RLock()
	bcache := fbo.config.BlockCache()
	if !bcache.IsDirty(file.TailPointer(), file.Branch) {
		fbo.blockLock.RUnlock()
		return nil
	}
	fbo.blockLock.RUnlock()

	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked()
	if err != nil {
		return err
	}

	// If the MD doesn't match the MD expected by the path, that
	// implies we are using a cached path, which implies the node has
	// been unlinked.  In that case, we can safely ignore this sync.
	if stripBP(md.data.Dir.BlockPointer) != stripBP(file.Path[0].BlockPointer) {
		return nil
	}

	doUnlock := true
	fbo.blockLock.RLock()
	defer func() {
		if doUnlock {
			fbo.blockLock.RUnlock()
		}
	}()

	// update the parent directories, and write all the new blocks out
	// to disk
	fblock, err := fbo.getFileLocked(md, file, write)
	if err != nil {
		return err
	}

	user, err := fbo.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return err
	}

	bps := newBlockPutState(1)
	fbo.cacheLock.Lock()
	filePtr := stripBP(file.TailPointer())
	si := fbo.unrefCache[filePtr]
	fbo.cacheLock.Unlock()
	md.AddOp(si.op)
	// Note: below we add possibly updated file blocks as "unref" and
	// "ref" blocks.  This is fine, since conflict resolution or
	// notifications will never happen within a file.

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
	bsplit := fbo.config.BlockSplitter()
	var deferredDirtyDeletes []func() error
	if fblock.IsInd {
		for i := 0; i < len(fblock.IPtrs); i++ {
			ptr := fblock.IPtrs[i]
			isDirty := bcache.IsDirty(ptr.BlockPointer, file.Branch)
			if (ptr.EncodedSize > 0) && isDirty {
				return InconsistentEncodedSizeError{ptr.BlockInfo}
			}
			if isDirty {
				_, _, _, block, more, _, err :=
					fbo.getFileBlockAtOffsetLocked(md, file, fblock,
						ptr.Off, write)
				if err != nil {
					return err
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
						if err := fbo.newRightBlockLocked(
							file.TailPointer(), file.Branch, fblock,
							endOfBlock, md); err != nil {
							return err
						}
					}
					rPtr, _, _, rblock, _, _, err :=
						fbo.getFileBlockAtOffsetLocked(md, file, fblock,
							endOfBlock, write)
					if err != nil {
						return err
					}
					rblock.Contents = append(extraBytes, rblock.Contents...)
					if err = fbo.cacheBlockIfNotYetDirtyLocked(
						rPtr, file.Branch, rblock); err != nil {
						return err
					}
					fblock.IPtrs[i+1].Off = ptr.Off + int64(len(block.Contents))
					md.AddUnrefBlock(fblock.IPtrs[i+1].BlockInfo)
					fblock.IPtrs[i+1].EncodedSize = 0
				case splitAt < 0:
					if !more {
						// end of the line
						continue
					}

					endOfBlock := ptr.Off + int64(len(block.Contents))
					rPtr, _, _, rblock, _, _, err :=
						fbo.getFileBlockAtOffsetLocked(md, file, fblock,
							endOfBlock, write)
					if err != nil {
						return err
					}
					// copy some of that block's data into this block
					nCopied := bsplit.CopyUntilSplit(block, false,
						rblock.Contents, int64(len(block.Contents)))
					rblock.Contents = rblock.Contents[nCopied:]
					if len(rblock.Contents) > 0 {
						if err = fbo.cacheBlockIfNotYetDirtyLocked(
							rPtr, file.Branch, rblock); err != nil {
							return err
						}
						fblock.IPtrs[i+1].Off =
							ptr.Off + int64(len(block.Contents))
						md.AddUnrefBlock(fblock.IPtrs[i+1].BlockInfo)
						fblock.IPtrs[i+1].EncodedSize = 0
					} else {
						// TODO: delete the block, and if we're down
						// to just one indirect block, remove the
						// layer of indirection
						//
						// TODO: When we implement more than one level
						// of indirection, make sure that the pointer
						// to the parent block in the grandparent
						// block has EncodedSize 0.
						md.AddUnrefBlock(fblock.IPtrs[i+1].BlockInfo)
						fblock.IPtrs =
							append(fblock.IPtrs[:i+1], fblock.IPtrs[i+2:]...)
					}
				}
			}
		}

		for i, ptr := range fblock.IPtrs {
			// TODO: parallelize these?
			isDirty := bcache.IsDirty(ptr.BlockPointer, file.Branch)
			if (ptr.EncodedSize > 0) && isDirty {
				return &InconsistentEncodedSizeError{ptr.BlockInfo}
			}
			if isDirty {
				_, _, _, block, _, _, err := fbo.getFileBlockAtOffsetLocked(
					md, file, fblock, ptr.Off, write)
				if err != nil {
					return err
				}

				newInfo, _, readyBlockData, err :=
					fbo.readyBlock(md, block, user)
				if err != nil {
					return err
				}

				// put the new block in the cache, but defer the
				// finalize until after the new path is ready, in case
				// anyone tries to read the dirty file in the
				// meantime.
				bcache.Put(newInfo.ID, block)
				localPtr := ptr.BlockPointer
				deferredDirtyDeletes =
					append(deferredDirtyDeletes, func() error {
						return bcache.DeleteDirty(localPtr, file.Branch)
					})

				fblock.IPtrs[i].BlockInfo = newInfo
				md.AddRefBlock(newInfo)
				bps.addNewBlock(newInfo.BlockPointer, block, readyBlockData)
				fbo.copyFileBlocks[localPtr] = true
			}
		}
	}

	fbo.copyFileBlocks[file.TailPointer()] = true

	parentPath := file.ParentPath()
	dblock, err := fbo.getDirLocked(md, *parentPath, write)
	if err != nil {
		return err
	}
	lbc := make(localBcache)

	// add in the cached unref pieces and fixup the dir entry
	fbo.cacheLock.Lock()
	fbo.mergeUnrefCacheLocked(file, md)

	// update the file's directory entry to the cached copy
	parentPtr := stripBP(parentPath.TailPointer())
	doDeleteDe := false
	if deMap, ok := fbo.deCache[parentPtr]; ok {
		if de, ok := deMap[filePtr]; ok {
			// remember the old info
			de.EncodedSize = si.oldInfo.EncodedSize
			dblock.Children[file.TailName()] = de
			lbc[parentPath.TailPointer()] = dblock
			doDeleteDe = true
			delete(deMap, filePtr)
			if deMap == nil {
				delete(fbo.deCache, parentPtr)
			} else {
				fbo.deCache[parentPtr] = deMap
			}
		}
	}
	fbo.cacheLock.Unlock()

	doUnlock = false
	fbo.blockLock.RUnlock()

	// TODO: parallelize me
	bops := fbo.config.BlockOps()
	for _, blockState := range bps.blockStates {
		if err = bops.Put(md, blockState.blockPtr,
			blockState.readyBlockData); err != nil {
			return err
		}
	}

	newPath, _, bps, err :=
		fbo.syncBlockLocked(md, fblock, *parentPath, file.TailName(),
			File, true, true, zeroPtr, lbc)
	if err != nil {
		return err
	}

	// Make the block available at the new ID, but keep it under the
	// old ID in case someone tries to read the file under the old ID
	// before the sync is complete.
	err = func() error {
		fbo.blockLock.Lock()
		defer fbo.blockLock.Unlock()
		err := bcache.Put(newPath.TailPointer().ID, fblock)
		if err != nil {
			return err
		}
		deferredDirtyDeletes = append(deferredDirtyDeletes, func() error {
			return bcache.DeleteDirty(file.TailPointer(), file.Branch)
		})
		return nil
	}()
	if err != nil {
		return err
	}

	err = fbo.finalizeWriteLocked(ctx, md, bps, []Path{newPath})
	if err != nil {
		return err
	}

	fbo.blockLock.Lock()
	defer fbo.blockLock.Unlock()
	err = func() error {
		fbo.cacheLock.Lock()
		defer fbo.cacheLock.Unlock()
		for _, f := range deferredDirtyDeletes {
			// This will also clear any dirty blocks that resulted from a
			// write/truncate happening during the sync.  But that's ok,
			// because we will redo them below.
			err = f()
			if err != nil {
				return err
			}
		}

		// Clear the updated de from the cache.  We are guaranteed that
		// any concurrent write to this file was deferred, even if it was
		// to a block that wasn't currently being sync'd, since the
		// top-most block is always in copyFileBlocks and is always
		// dirtied during a write/truncate.
		if doDeleteDe {
			deMap := fbo.deCache[parentPtr]
			delete(deMap, filePtr)
			if deMap == nil {
				delete(fbo.deCache, parentPtr)
			} else {
				fbo.deCache[parentPtr] = deMap
			}
		}

		// we can get rid of all the sync state that might have
		// happened during the sync, since we will replay the writes
		// below anyway.
		delete(fbo.unrefCache, filePtr)
		return nil
	}()
	if err != nil {
		return err
	}

	fbo.copyFileBlocks = make(map[BlockPointer]bool)
	// Redo any writes or truncates that happened to our file while
	// the sync was happening.
	writes := fbo.deferredWrites
	fbo.deferredWrites = nil
	for _, f := range writes {
		// we can safely read head here because we hold writerLock
		err = f(ctx, fbo.head, newPath)
		if err != nil {
			// It's a little weird to return an error from a deferred
			// write here. Hopefully that will never happen.
			return err
		}
	}

	return nil
}

// Sync implements the KBFSOps interface for FolderBranchOps
func (fbo *FolderBranchOps) Sync(ctx context.Context, file Node) (err error) {
	err = fbo.checkNode(file)
	if err != nil {
		return
	}

	fbo.writerLock.Lock()
	defer fbo.writerLock.Unlock()
	filePath := fbo.nodeCache.PathFromNode(file)
	return fbo.syncLocked(ctx, filePath)
}

// RegisterForChanges registers a single Observer to receive
// notifications about this folder/branch.
func (fbo *FolderBranchOps) RegisterForChanges(obs Observer) error {
	fbo.obsLock.Lock()
	defer fbo.obsLock.Unlock()
	// It's the caller's responsibility to make sure
	// RegisterForChanges isn't called twice for the same Observer
	fbo.observers = append(fbo.observers, obs)
	return nil
}

// UnregisterFromChanges stops an Observer from getting notifications
// about the folder/branch.
func (fbo *FolderBranchOps) UnregisterFromChanges(obs Observer) error {
	fbo.obsLock.Lock()
	defer fbo.obsLock.Unlock()
	for i, oldObs := range fbo.observers {
		if oldObs == obs {
			fbo.observers = append(fbo.observers[:i], fbo.observers[i+1:]...)
			break
		}
	}
	return nil
}

func (fbo *FolderBranchOps) notifyLocal(ctx context.Context, path Path) {
	fbo.obsLock.RLock()
	defer fbo.obsLock.RUnlock()
	for _, obs := range fbo.observers {
		obs.LocalChange(ctx, path)
	}
}

func (fbo *FolderBranchOps) notifyBatch(
	ctx context.Context, dir DirID, paths []Path) {
	fbo.obsLock.RLock()
	defer fbo.obsLock.RUnlock()
	for _, obs := range fbo.observers {
		obs.BatchChanges(ctx, dir, paths)
	}
}
