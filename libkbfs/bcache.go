package libkbfs

import (
	"fmt"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
)

type dirtyBlockID struct {
	id       BlockID
	refNonce BlockRefNonce
	branch   BranchName
}

type idCacheKey struct {
	tlf           TlfID
	plaintextHash libkb.NodeHash
}

// BlockCacheStandard implements the BlockCache interface by storing
// blocks in an in-memory LRU cache.  Clean blocks are identified
// internally by just their block ID (since blocks are immutable and
// content-addressable).  Dirty blocks are identified by their block
// ID, branch name, and reference nonce, since the same block may be
// forked and modified on different branches and under different
// references simultaneously.
type BlockCacheStandard struct {
	config    Config
	blocks    *lru.Cache
	ids       *lru.Cache
	dirty     map[dirtyBlockID]Block
	dirtyLock sync.RWMutex
}

// NewBlockCacheStandard constructs a new BlockCacheStandard instance
// with the given cache capacity.
func NewBlockCacheStandard(config Config, capacity int) *BlockCacheStandard {
	blockLRU, err := lru.New(capacity)
	if err != nil {
		return nil
	}
	idLRU, err := lru.New(capacity)
	if err != nil {
		return nil
	}
	return &BlockCacheStandard{
		config:    config,
		blocks:    blockLRU,
		ids:       idLRU,
		dirty:     make(map[dirtyBlockID]Block),
		dirtyLock: sync.RWMutex{},
	}
}

// Get implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) Get(ptr BlockPointer, branch BranchName) (
	Block, error) {
	dirtyID := dirtyBlockID{
		id:       ptr.ID,
		refNonce: ptr.RefNonce,
		branch:   branch,
	}

	b.dirtyLock.RLock()
	defer b.dirtyLock.RUnlock()

	if block, ok := b.dirty[dirtyID]; ok {
		return block, nil
	}
	if tmp, ok := b.blocks.Get(ptr.ID); ok {
		block, ok := tmp.(Block)
		if !ok {
			return nil, BadDataError{ptr.ID}
		}
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

	hash, err := b.config.Crypto().Hash(block.Contents)
	if err != nil {
		return BlockPointer{}, err
	}

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
	ptr BlockPointer, tlf TlfID, block Block) error {
	b.blocks.Add(ptr.ID, block)

	// If it's the right type of block, store the hash -> ID mapping
	if fBlock, ok := block.(*FileBlock); ok && !fBlock.IsInd {
		hash, err := b.config.Crypto().Hash(fBlock.Contents)
		if err != nil {
			return err
		}

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

// Delete implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) Delete(id BlockID) error {
	b.blocks.Remove(id)
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
