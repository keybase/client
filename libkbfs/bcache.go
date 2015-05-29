package libkbfs

import (
	"sync"

	lru "github.com/hashicorp/golang-lru"
)

// BlockCacheStandard implements the BlockCache interface by storing
// blocks in an in-memomry LRU cache.
type BlockCacheStandard struct {
	lru       *lru.Cache
	dirty     map[BlockID]Block
	dirtyLock sync.RWMutex
}

// NewBlockCacheStandard constructs a new BlockCacheStandard instance
// with the given cache capacity.
func NewBlockCacheStandard(capacity int) *BlockCacheStandard {
	tmp, err := lru.New(capacity)
	if err != nil {
		return nil
	}
	return &BlockCacheStandard{tmp, make(map[BlockID]Block), sync.RWMutex{}}
}

// Get implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) Get(id BlockID) (Block, error) {
	b.dirtyLock.RLock()
	defer b.dirtyLock.RUnlock()

	if block, ok := b.dirty[id]; ok {
		return block, nil
	}
	if tmp, ok := b.lru.Get(id); ok {
		block, ok := tmp.(Block)
		if !ok {
			return nil, &BadDataError{id}
		}
		return block, nil
	}
	return nil, &NoSuchBlockError{id}
}

// Put implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) Put(id BlockID, block Block, dirty bool) error {
	if dirty {
		b.dirtyLock.Lock()
		defer b.dirtyLock.Unlock()
		b.dirty[id] = block
	} else {
		b.lru.Add(id, block)
	}
	return nil
}

func (b *BlockCacheStandard) deleteLocked(id BlockID) error {
	delete(b.dirty, id)
	b.lru.Remove(id)
	return nil
}

// Delete implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) Delete(id BlockID) error {
	b.dirtyLock.Lock()
	defer b.dirtyLock.Unlock()
	return b.deleteLocked(id)
}

// Finalize implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) Finalize(oldID BlockID, newID BlockID) error {
	b.dirtyLock.Lock()
	defer b.dirtyLock.Unlock()

	if block, ok := b.dirty[oldID]; ok {
		b.deleteLocked(oldID)
		b.Put(newID, block, false)
		return nil
	}
	return &FinalizeError{oldID}
}

// IsDirty implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) IsDirty(id BlockID) (isDirty bool) {
	b.dirtyLock.RLock()
	defer b.dirtyLock.RUnlock()

	_, isDirty = b.dirty[id]
	return
}
