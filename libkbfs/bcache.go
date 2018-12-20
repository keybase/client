// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"sync/atomic"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
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
	cleanPermanent map[kbfsblock.ID]Block

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
		cleanPermanent:     make(map[kbfsblock.ID]Block),
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

// GetWithLifetime implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) GetWithLifetime(ptr BlockPointer) (
	Block, BlockCacheLifetime, error) {
	if b.cleanTransient != nil {
		if tmp, ok := b.cleanTransient.Get(ptr.ID); ok {
			block, ok := tmp.(Block)
			if !ok {
				return nil, NoCacheEntry, BadDataError{ptr.ID}
			}
			return block, TransientEntry, nil
		}
	}

	block := func() Block {
		b.cleanLock.RLock()
		defer b.cleanLock.RUnlock()
		return b.cleanPermanent[ptr.ID]
	}()
	if block != nil {
		return block, PermanentEntry, nil
	}

	return nil, NoCacheEntry, NoSuchBlockError{ptr.ID}
}

// Get implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) Get(ptr BlockPointer) (Block, error) {
	block, _, err := b.GetWithLifetime(ptr)
	return block, err
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

func (b *BlockCacheStandard) subtractBlockBytes(block Block) {
	size := uint64(getCachedBlockSize(block))
	b.bytesLock.Lock()
	defer b.bytesLock.Unlock()
	if b.cleanTotalBytes >= size {
		b.cleanTotalBytes -= size
	} else {
		// In case the race mentioned in `PutWithPrefetch` causes us
		// to undercut the byte count.
		b.cleanTotalBytes = 0
	}
}

func (b *BlockCacheStandard) onEvict(key interface{}, value interface{}) {
	block, ok := value.(Block)
	if !ok {
		return
	}
	b.subtractBlockBytes(block)
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

	key := idCacheKey{tlf, block.GetHash()}
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

// SetCleanBytesCapacity implements the BlockCache interface for
// BlockCacheStandard.
func (b *BlockCacheStandard) SetCleanBytesCapacity(capacity uint64) {
	atomic.StoreUint64(&b.cleanBytesCapacity, capacity)
}

// GetCleanBytesCapacity implements the BlockCache interface for
// BlockCacheStandard.
func (b *BlockCacheStandard) GetCleanBytesCapacity() (capacity uint64) {
	return atomic.LoadUint64(&b.cleanBytesCapacity)
}

func (b *BlockCacheStandard) makeRoomForSize(size uint64, lifetime BlockCacheLifetime) bool {
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

	cleanBytesCapacity := b.GetCleanBytesCapacity()

	// Evict items from the cache until the bytes capacity is lower
	// than the total capacity (or until no items are removed).
	for b.cleanTotalBytes+size > cleanBytesCapacity {
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
			doUnlock = true
			b.bytesLock.Lock()
			break
		}
		oldLen = b.cleanTransient.Len()
		b.cleanTransient.RemoveOldest()
		doUnlock = true
		b.bytesLock.Lock()
	}

	if b.cleanTotalBytes+size > cleanBytesCapacity {
		// There must be too many permanent clean blocks, so we
		// couldn't make room.
		if lifetime == PermanentEntry {
			// Permanent entries will be added no matter what, so we have to
			// account for them.
			b.cleanTotalBytes += size
		}
		return false
	}
	// Only count clean bytes if we actually have a transient cache.
	b.cleanTotalBytes += size
	return true
}

// Put implements the BlockCache interface for BlockCacheStandard.
// This method is idempotent for a given ptr, but that invariant is
// not currently goroutine-safe, and it does not hold if a block size
// changes between Puts. That is, we assume that a cached block
// associated with a given pointer will never change its size, even
// when it gets Put into the cache again.
func (b *BlockCacheStandard) Put(
	ptr BlockPointer, tlf tlf.ID, block Block,
	lifetime BlockCacheLifetime) error {
	// We first check if the block shouldn't be cached, since CommonBlocks can
	// take this path.
	if lifetime == NoCacheEntry {
		return nil
	}
	// Just in case we tried to cache a block type that shouldn't be cached,
	// return an error. This is an insurance check. That said, this got rid of
	// a flake in TestSBSConflicts, so we should still look for the underlying
	// error.
	switch block.(type) {
	case *DirBlock:
	case *FileBlock:
	case *CommonBlock:
		return errors.New("attempted to Put a common block")
	default:
		return errors.Errorf("attempted to Put an unknown block type %T", block)
	}

	var wasInCache bool

	switch lifetime {
	case TransientEntry:
		// If it's the right type of block, store the hash -> ID mapping.
		if fBlock, isFileBlock := block.(*FileBlock); b.ids != nil &&
			isFileBlock && !fBlock.IsInd {

			key := idCacheKey{tlf, fBlock.GetHash()}
			// zero out the refnonce, it doesn't matter
			ptr.RefNonce = kbfsblock.ZeroRefNonce
			b.ids.Add(key, ptr)
		}
		if b.cleanTransient == nil {
			return nil
		}
		// We could use `cleanTransient.Contains()`, but that wouldn't update
		// the LRU time. By using `Get`, we make it less likely that another
		// goroutine will evict this block before we can `Put` it again.
		_, wasInCache = b.cleanTransient.Get(ptr.ID)
		// Cache it later, once we know there's room

	case PermanentEntry:
		func() {
			b.cleanLock.Lock()
			defer b.cleanLock.Unlock()
			_, wasInCache = b.cleanPermanent[ptr.ID]
			b.cleanPermanent[ptr.ID] = block
		}()

	default:
		return fmt.Errorf("Unknown lifetime %v", lifetime)
	}

	transientCacheHasRoom := true
	// We must make room whether the cache is transient or permanent, but only
	// if it wasn't already in the cache.
	// TODO: This is racy, where another goroutine can evict or add this block
	// between our check above and our attempt to make room. If the other
	// goroutine evicts this block, we under-count its size as 0. If the other
	// goroutine inserts this block, we double-count it.
	if !wasInCache {
		size := uint64(getCachedBlockSize(block))
		transientCacheHasRoom = b.makeRoomForSize(size, lifetime)
	}
	if lifetime == TransientEntry {
		if !transientCacheHasRoom {
			return cachePutCacheFullError{ptr.ID}
		}
		b.cleanTransient.Add(ptr.ID, block)
	}

	return nil
}

// DeletePermanent implements the BlockCache interface for
// BlockCacheStandard.
func (b *BlockCacheStandard) DeletePermanent(id kbfsblock.ID) error {
	b.cleanLock.Lock()
	defer b.cleanLock.Unlock()
	block, ok := b.cleanPermanent[id]
	if ok {
		delete(b.cleanPermanent, id)
		b.subtractBlockBytes(block)
	}
	return nil
}

// DeleteTransient implements the BlockCache interface for BlockCacheStandard.
func (b *BlockCacheStandard) DeleteTransient(
	id kbfsblock.ID, tlf tlf.ID) error {
	if b.cleanTransient == nil {
		return nil
	}

	// If the block is cached and a file block, delete the known
	// pointer as well.
	if tmp, ok := b.cleanTransient.Get(id); ok {
		block, ok := tmp.(Block)
		if !ok {
			return BadDataError{id}
		}

		// Remove the key if it exists
		if fBlock, ok := block.(*FileBlock); b.ids != nil && ok &&
			!fBlock.IsInd {
			_, hash := kbfshash.DoRawDefaultHash(fBlock.Contents)
			key := idCacheKey{tlf, hash}
			b.ids.Remove(key)
		}

		b.cleanTransient.Remove(id)
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
