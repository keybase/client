package libkbfs

import (
	"fmt"
	"sync"

	lru "github.com/hashicorp/golang-lru"
)

type dirtyBlockID struct {
	id       BlockID
	refNonce BlockRefNonce
	branch   BranchName
}

type idCacheKey struct {
	tlf           TlfID
	plaintextHash RawDefaultHash
}

// BlockCacheStandard implements the BlockCache interface by storing
// blocks in an in-memory LRU cache.  Clean blocks are identified
// internally by just their block ID (since blocks are immutable and
// content-addressable).  Dirty blocks are identified by their block
// ID, branch name, and reference nonce, since the same block may be
// forked and modified on different branches and under different
// references simultaneously.
type BlockCacheStandard struct {
	config Config

	ids *lru.Cache

	cleanTransient *lru.Cache

	cleanLock      sync.RWMutex
	cleanPermanent map[BlockID]Block

	dirtyLock sync.RWMutex
	dirty     map[dirtyBlockID]Block
}

// NewBlockCacheStandard constructs a new BlockCacheStandard instance
// with the given transient capacity.
func NewBlockCacheStandard(config Config, transientCapacity int) *BlockCacheStandard {
	var transientCleanLRU, idLRU *lru.Cache
	if transientCapacity > 0 {
		var err error
		// TODO: Plumb error up.
		idLRU, err = lru.New(transientCapacity)
		if err != nil {
			return nil
		}

		transientCleanLRU, err = lru.New(transientCapacity)
		if err != nil {
			return nil
		}
	}
	return &BlockCacheStandard{
		config:         config,
		ids:            idLRU,
		cleanTransient: transientCleanLRU,
		cleanPermanent: make(map[BlockID]Block),
		dirty:          make(map[dirtyBlockID]Block),
	}
}

// Get implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) Get(ptr BlockPointer, branch BranchName) (
	Block, error) {
	block := func() Block {
		dirtyID := dirtyBlockID{
			id:       ptr.ID,
			refNonce: ptr.RefNonce,
			branch:   branch,
		}
		b.dirtyLock.RLock()
		defer b.dirtyLock.RUnlock()
		return b.dirty[dirtyID]
	}()
	if block != nil {
		return block, nil
	}

	if b.cleanTransient != nil {
		if tmp, ok := b.cleanTransient.Get(ptr.ID); ok {
			block, ok := tmp.(Block)
			if !ok {
				return nil, BadDataError{ptr.ID}
			}
			return block, nil
		}
	}

	block = func() Block {
		b.cleanLock.RLock()
		defer b.cleanLock.RUnlock()
		return b.cleanPermanent[ptr.ID]
	}()
	if block != nil {
		return block, nil
	}

	return nil, NoSuchBlockError{ptr.ID}
}

// CheckForKnownPtr implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) CheckForKnownPtr(tlf TlfID, block *FileBlock) (
	BlockPointer, error) {
	if block.IsInd {
		return BlockPointer{}, NotDirectFileBlockError{}
	}

	if b.ids == nil {
		return BlockPointer{}, nil
	}

	_, hash := DoRawDefaultHash(block.Contents)
	key := idCacheKey{tlf, hash}
	tmp, ok := b.ids.Get(key)
	if !ok {
		return BlockPointer{}, nil
	}

	ptr, ok := tmp.(BlockPointer)
	if !ok {
		return BlockPointer{}, fmt.Errorf("Unexpected cached id: %v", tmp)
	}
	return ptr, nil
}

// Put implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) Put(
	ptr BlockPointer, tlf TlfID, block Block, lifetime BlockCacheLifetime) error {
	switch lifetime {
	case TransientEntry:
		if b.cleanTransient != nil {
			b.cleanTransient.Add(ptr.ID, block)
		}

	case PermanentEntry:
		func() {
			b.cleanLock.Lock()
			defer b.cleanLock.Unlock()
			b.cleanPermanent[ptr.ID] = block
		}()

	default:
		return fmt.Errorf("Unknown lifetime %v", lifetime)
	}

	// If it's the right type of block and lifetime, store the
	// hash -> ID mapping.
	if fBlock, ok := block.(*FileBlock); b.ids != nil && lifetime == TransientEntry && ok && !fBlock.IsInd {
		_, hash := DoRawDefaultHash(fBlock.Contents)
		key := idCacheKey{tlf, hash}
		// zero out the refnonce, it doesn't matter
		ptr.RefNonce = zeroBlockRefNonce
		b.ids.Add(key, ptr)
	}

	return nil
}

// PutDirty implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) PutDirty(ptr BlockPointer,
	branch BranchName, block Block) error {
	dirtyID := dirtyBlockID{
		id:       ptr.ID,
		refNonce: ptr.RefNonce,
		branch:   branch,
	}

	b.dirtyLock.Lock()
	defer b.dirtyLock.Unlock()
	b.dirty[dirtyID] = block
	return nil
}

// DeletePermanent implements the BlockCache interface for
// BlockCacheStandard.
func (b *BlockCacheStandard) DeletePermanent(id BlockID) error {
	b.cleanLock.Lock()
	defer b.cleanLock.Unlock()
	delete(b.cleanPermanent, id)
	return nil
}

// DeleteDirty implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) DeleteDirty(
	ptr BlockPointer, branch BranchName) error {
	dirtyID := dirtyBlockID{
		id:       ptr.ID,
		refNonce: ptr.RefNonce,
		branch:   branch,
	}

	b.dirtyLock.Lock()
	defer b.dirtyLock.Unlock()
	delete(b.dirty, dirtyID)
	return nil
}

// IsDirty implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) IsDirty(
	ptr BlockPointer, branch BranchName) (isDirty bool) {
	dirtyID := dirtyBlockID{
		id:       ptr.ID,
		refNonce: ptr.RefNonce,
		branch:   branch,
	}

	b.dirtyLock.RLock()
	defer b.dirtyLock.RUnlock()
	_, isDirty = b.dirty[dirtyID]
	return
}
