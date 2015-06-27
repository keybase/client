package libkbfs

import (
	"sync"

	lru "github.com/hashicorp/golang-lru"
)

type dirtyBlockID struct {
	id       BlockID
	refNonce BlockRefNonce
	branch   BranchName
}

// BlockCacheStandard implements the BlockCache interface by storing
// blocks in an in-memory LRU cache.  Clean blocks are identified
// internally by just their block ID (since blocks are immutable and
// content-addressable).  Dirty blocks are identified by their block
// ID, branch name, and reference nonce, since the same block may be
// forked and modified on different branches and under different
// references simulatenously.
type BlockCacheStandard struct {
	lru       *lru.Cache
	dirty     map[dirtyBlockID]Block
	dirtyLock sync.RWMutex
}

// NewBlockCacheStandard constructs a new BlockCacheStandard instance
// with the given cache capacity.
func NewBlockCacheStandard(capacity int) *BlockCacheStandard {
	tmp, err := lru.New(capacity)
	if err != nil {
		return nil
	}
	return &BlockCacheStandard{
		lru:       tmp,
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
	if tmp, ok := b.lru.Get(ptr.ID); ok {
		block, ok := tmp.(Block)
		if !ok {
			return nil, &BadDataError{ptr.ID}
		}
		return block, nil
	}
	return nil, &NoSuchBlockError{ptr.ID}
}

// Put implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) Put(id BlockID, block Block) error {
	b.lru.Add(id, block)
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
	b.lru.Remove(id)
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
