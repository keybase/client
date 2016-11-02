// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/keybase/kbfs/tlf"
)

type idCacheKey struct {
	tlf           tlf.ID
	plaintextHash kbfshash.RawDefaultHash
}

// BlockCacheStandard implements the BlockCache interface by storing
// blocks in an in-memory LRU cache.  Clean blocks are identified
// internally by just their block ID (since blocks are immutable and
// content-addressable).
type BlockCacheStandard struct {
	cleanBytesCapacity uint64

	ids *lru.Cache

	cleanTransient *lru.Cache

	cleanLock      sync.RWMutex
	cleanPermanent map[BlockID]Block

	bytesLock       sync.Mutex
	cleanTotalBytes uint64
}

// NewBlockCacheStandard constructs a new BlockCacheStandard instance
// with the given transient capacity (in number of entries) and the
// clean bytes capacity, which is the total of number of bytes allowed
// between the transient and permanent clean caches.  If putting a
// block will exceed this bytes capacity, transient entries are
// evicted until the block will fit in capacity.
func NewBlockCacheStandard(transientCapacity int,
	cleanBytesCapacity uint64) *BlockCacheStandard {
	b := &BlockCacheStandard{
		cleanBytesCapacity: cleanBytesCapacity,
		cleanPermanent:     make(map[BlockID]Block),
	}

	if transientCapacity > 0 {
		var err error
		// TODO: Plumb error up.
		b.ids, err = lru.New(transientCapacity)
		if err != nil {
			return nil
		}

		b.cleanTransient, err = lru.NewWithEvict(transientCapacity, b.onEvict)
		if err != nil {
			return nil
		}
	}
	return b
}

// Get implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) Get(ptr BlockPointer) (Block, error) {
	if b.cleanTransient != nil {
		if tmp, ok := b.cleanTransient.Get(ptr.ID); ok {
			block, ok := tmp.(Block)
			if !ok {
				return nil, BadDataError{ptr.ID}
			}
			return block, nil
		}
	}

	block := func() Block {
		b.cleanLock.RLock()
		defer b.cleanLock.RUnlock()
		return b.cleanPermanent[ptr.ID]
	}()
	if block != nil {
		return block, nil
	}

	return nil, NoSuchBlockError{ptr.ID}
}

func getCachedBlockSize(block Block) uint32 {
	// Get the size of the block.  For direct file blocks, use the
	// length of the plaintext contents.  For everything else, just
	// approximate the plaintext size using the encoding size.
	switch b := block.(type) {
	case *FileBlock:
		if b.IsInd {
			return b.GetEncodedSize()
		}
		return uint32(len(b.Contents))
	default:
		return block.GetEncodedSize()
	}
}

func (b *BlockCacheStandard) onEvict(key interface{}, value interface{}) {
	block, ok := value.(Block)
	if !ok {
		return
	}

	b.bytesLock.Lock()
	defer b.bytesLock.Unlock()
	b.cleanTotalBytes -= uint64(getCachedBlockSize(block))
}

// CheckForKnownPtr implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) CheckForKnownPtr(tlf tlf.ID, block *FileBlock) (
	BlockPointer, error) {
	if block.IsInd {
		return BlockPointer{}, NotDirectFileBlockError{}
	}

	if b.ids == nil {
		return BlockPointer{}, nil
	}

	_, hash := kbfshash.DoRawDefaultHash(block.Contents)
	block.hash = &hash
	key := idCacheKey{tlf, *block.hash}
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

func (b *BlockCacheStandard) makeRoomForSize(size uint64) bool {
	if b.cleanTransient == nil {
		return false
	}

	oldLen := b.cleanTransient.Len() + 1
	doUnlock := true
	b.bytesLock.Lock()
	defer func() {
		if doUnlock {
			b.bytesLock.Unlock()
		}
	}()

	// Evict items from the cache until the bytes capacity is lower
	// than the total capacity (or until no items are removed).
	for b.cleanTotalBytes+size > b.cleanBytesCapacity {
		// Unlock while removing, since onEvict needs the lock and
		// cleanTransient.Len() takes the LRU mutex (which could lead
		// to a deadlock with onEvict).  TODO: either change
		// `cleanTransient` into an `lru.SimpleLRU` and protect it
		// with our own lock, or build our own LRU that can evict
		// based on total bytes.  See #250 and KBFS-1404 for a longer
		// discussion.
		b.bytesLock.Unlock()
		doUnlock = false
		if oldLen == b.cleanTransient.Len() {
			break
		}
		oldLen = b.cleanTransient.Len()
		b.cleanTransient.RemoveOldest()
		doUnlock = true
		b.bytesLock.Lock()
	}
	if b.cleanTotalBytes+size > b.cleanBytesCapacity {
		// There must be too many permanent clean blocks, so we
		// couldn't make room.
		return false
	}
	// Only count clean bytes if we actually have a transient cache.
	b.cleanTotalBytes += size
	return true
}

// Put implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) Put(
	ptr BlockPointer, tlf tlf.ID, block Block, lifetime BlockCacheLifetime) error {
	// If it's the right type of block and lifetime, store the
	// hash -> ID mapping.
	if fBlock, ok := block.(*FileBlock); b.ids != nil && lifetime == TransientEntry && ok && !fBlock.IsInd {
		if fBlock.hash == nil {
			_, hash := kbfshash.DoRawDefaultHash(fBlock.Contents)
			fBlock.hash = &hash
		}

		key := idCacheKey{tlf, *fBlock.hash}
		// zero out the refnonce, it doesn't matter
		ptr.RefNonce = ZeroBlockRefNonce
		b.ids.Add(key, ptr)
	}

	switch lifetime {
	case TransientEntry:
		// Cache it later, once we know there's room

	case PermanentEntry:
		func() {
			b.cleanLock.Lock()
			defer b.cleanLock.Unlock()
			b.cleanPermanent[ptr.ID] = block
		}()

	default:
		return fmt.Errorf("Unknown lifetime %v", lifetime)
	}

	size := uint64(getCachedBlockSize(block))
	madeRoom := b.makeRoomForSize(size)
	if madeRoom && lifetime == TransientEntry && b.cleanTransient != nil {
		b.cleanTransient.Add(ptr.ID, block)
	}
	return nil
}

// DeletePermanent implements the BlockCache interface for
// BlockCacheStandard.
func (b *BlockCacheStandard) DeletePermanent(id BlockID) error {
	b.cleanLock.Lock()
	defer b.cleanLock.Unlock()
	block, ok := b.cleanPermanent[id]
	if ok {
		delete(b.cleanPermanent, id)
		b.bytesLock.Lock()
		defer b.bytesLock.Unlock()
		b.cleanTotalBytes -= uint64(getCachedBlockSize(block))
	}
	return nil
}

// DeleteTransient implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) DeleteTransient(
	ptr BlockPointer, tlf tlf.ID) error {
	if b.cleanTransient == nil {
		return nil
	}

	// If the block is cached and a file block, delete the known
	// pointer as well.
	if tmp, ok := b.cleanTransient.Get(ptr.ID); ok {
		block, ok := tmp.(Block)
		if !ok {
			return BadDataError{ptr.ID}
		}

		// Remove the key if it exists
		if fBlock, ok := block.(*FileBlock); b.ids != nil && ok &&
			!fBlock.IsInd {
			_, hash := kbfshash.DoRawDefaultHash(fBlock.Contents)
			key := idCacheKey{tlf, hash}
			b.ids.Remove(key)
		}

		b.cleanTransient.Remove(ptr.ID)
	}
	return nil
}

// DeleteKnownPtr implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) DeleteKnownPtr(tlf tlf.ID, block *FileBlock) error {
	if block.IsInd {
		return NotDirectFileBlockError{}
	}

	if b.ids == nil {
		return nil
	}

	_, hash := kbfshash.DoRawDefaultHash(block.Contents)
	key := idCacheKey{tlf, hash}
	b.ids.Remove(key)
	return nil
}
