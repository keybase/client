package libkbfs

import (
	"sync"

	lru "github.com/hashicorp/golang-lru"
)

type BlockCacheStandard struct {
	lru       *lru.Cache
	dirty     map[BlockId]Block
	dirtyLock sync.RWMutex
}

func NewBlockCacheStandard(capacity int) *BlockCacheStandard {
	tmp, err := lru.New(capacity)
	if err != nil {
		return nil
	}
	return &BlockCacheStandard{tmp, make(map[BlockId]Block), sync.RWMutex{}}
}

func (b *BlockCacheStandard) Get(id BlockId) (Block, error) {
	b.dirtyLock.RLock()
	defer b.dirtyLock.RUnlock()

	if block, ok := b.dirty[id]; ok {
		return block, nil
	}
	if tmp, ok := b.lru.Get(id); ok {
		if block, ok := tmp.(Block); ok {
			return block, nil
		} else {
			return nil, &BadDataError{id}
		}
	}
	return nil, &NoSuchBlockError{id}
}

func (b *BlockCacheStandard) Put(id BlockId, block Block, dirty bool) error {
	if dirty {
		b.dirtyLock.Lock()
		defer b.dirtyLock.Unlock()
		b.dirty[id] = block
	} else {
		b.lru.Add(id, block)
	}
	return nil
}

func (b *BlockCacheStandard) deleteLocked(id BlockId) error {
	delete(b.dirty, id)
	b.lru.Remove(id)
	return nil
}

func (b *BlockCacheStandard) Delete(id BlockId) error {
	b.dirtyLock.Lock()
	defer b.dirtyLock.Unlock()
	return b.deleteLocked(id)
}

func (b *BlockCacheStandard) Finalize(oldId BlockId, newId BlockId) error {
	b.dirtyLock.Lock()
	defer b.dirtyLock.Unlock()

	if block, ok := b.dirty[oldId]; ok {
		b.deleteLocked(oldId)
		b.Put(newId, block, false)
		return nil
	}
	return &FinalizeError{oldId}
}

func (b *BlockCacheStandard) IsDirty(id BlockId) (isDirty bool) {
	b.dirtyLock.RLock()
	defer b.dirtyLock.RUnlock()

	_, isDirty = b.dirty[id]
	return
}
