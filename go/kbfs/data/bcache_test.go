// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"crypto/rand"
	"testing"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfshash"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

func blockCacheTestInit(t *testing.T, capacity int,
	bytesCapacity uint64) *BlockCacheStandard {
	return NewBlockCacheStandard(capacity, bytesCapacity)
}

func testBcachePutWithBlock(t *testing.T, id kbfsblock.ID, bcache BlockCache, lifetime BlockCacheLifetime, block Block) {
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, tlf.Private)

	// put the block
	err := bcache.Put(ptr, tlf, block, lifetime, SkipCacheHash)
	require.NoError(t, err)

	// make sure we can get it successfully
	block2, err := bcache.Get(ptr)
	require.NoError(t, err)
	require.Equal(t, block, block2)
}

func testBcachePut(t *testing.T, id kbfsblock.ID, bcache BlockCache, lifetime BlockCacheLifetime) {
	block := NewFileBlock()
	testBcachePutWithBlock(t, id, bcache, lifetime, block)
}

func testExpectedMissing(t *testing.T, id kbfsblock.ID, bcache BlockCache) {
	expectedErr := NoSuchBlockError{id}
	ptr := BlockPointer{ID: id}
	_, err := bcache.Get(ptr)
	require.EqualError(t, err, expectedErr.Error())
}

func TestBlockCachePut(t *testing.T) {
	bcache := blockCacheTestInit(t, 100, 1<<30)
	testBcachePut(t, kbfsblock.FakeID(1), bcache, TransientEntry)
	testBcachePut(t, kbfsblock.FakeID(2), bcache, PermanentEntry)
}

func TestBlockCachePutPastCapacity(t *testing.T) {
	bcache := blockCacheTestInit(t, 2, 1<<30)
	id1 := kbfsblock.FakeID(1)
	testBcachePut(t, id1, bcache, TransientEntry)
	id2 := kbfsblock.FakeID(2)
	testBcachePut(t, id2, bcache, TransientEntry)
	testBcachePut(t, kbfsblock.FakeID(3), bcache, TransientEntry)

	// now block 1 should have been kicked out
	testExpectedMissing(t, id1, bcache)

	// but 2 should still be there
	_, err := bcache.Get(BlockPointer{ID: id2})
	require.NoError(t, err)

	// permanent blocks don't count
	testBcachePut(t, kbfsblock.FakeID(4), bcache, PermanentEntry)
}

func TestBlockCacheCheckPtrSuccess(t *testing.T) {
	bcache := blockCacheTestInit(t, 100, 1<<30)

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := kbfsblock.FakeID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, tlf.Private)

	err := bcache.Put(ptr, tlf, block, TransientEntry, DoCacheHash)
	require.NoError(t, err)

	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block)
	require.NoError(t, err)
	require.Equal(t, ptr, checkedPtr)
}

func TestBlockCacheCheckPtrPermanent(t *testing.T) {
	bcache := blockCacheTestInit(t, 100, 1<<30)

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := kbfsblock.FakeID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, tlf.Private)

	err := bcache.Put(ptr, tlf, block, PermanentEntry, SkipCacheHash)
	require.NoError(t, err)

	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block)
	require.NoError(t, err)
	require.Equal(t, BlockPointer{}, checkedPtr)
}

func TestBlockCacheCheckPtrNotFound(t *testing.T) {
	bcache := blockCacheTestInit(t, 100, 1<<30)

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := kbfsblock.FakeID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, tlf.Private)

	err := bcache.Put(ptr, tlf, block, TransientEntry, DoCacheHash)
	require.NoError(t, err)

	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{4, 3, 2, 1}
	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block2)
	require.NoError(t, err)
	require.False(t, checkedPtr.IsInitialized())
}

func TestBlockCacheDeleteTransient(t *testing.T) {
	bcache := blockCacheTestInit(t, 100, 1<<30)

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := kbfsblock.FakeID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, tlf.Private)

	err := bcache.Put(ptr, tlf, block, TransientEntry, DoCacheHash)
	require.NoError(t, err)

	err = bcache.DeleteTransient(ptr.ID, tlf)
	require.NoError(t, err)

	// Make sure the pointer is gone from the hash cache too.
	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block)
	require.NoError(t, err)
	require.False(t, checkedPtr.IsInitialized())
}

func TestBlockCacheDeletePermanent(t *testing.T) {
	bcache := blockCacheTestInit(t, 100, 1<<30)

	id1 := kbfsblock.FakeID(1)
	testBcachePut(t, id1, bcache, PermanentEntry)

	id2 := kbfsblock.FakeID(2)
	block2 := NewFileBlock()
	testBcachePutWithBlock(t, id2, bcache, TransientEntry, block2)
	testBcachePutWithBlock(t, id2, bcache, PermanentEntry, block2)

	err := bcache.DeletePermanent(id1)
	require.NoError(t, err)
	err = bcache.DeletePermanent(id2)
	require.NoError(t, err)
	testExpectedMissing(t, id1, bcache)

	// 2 should still be there
	_, err = bcache.Get(BlockPointer{ID: id2})
	require.NoError(t, err)
}

func TestBlockCacheEmptyTransient(t *testing.T) {
	bcache := blockCacheTestInit(t, 0, 1<<30)

	block := NewFileBlock()
	id := kbfsblock.FakeID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, tlf.Private)

	// Make sure all the operations work even if the cache has no
	// transient capacity.

	err := bcache.Put(ptr, tlf, block, TransientEntry, DoCacheHash)
	require.NoError(t, err)

	_, err = bcache.Get(ptr)
	require.EqualError(t, err, NoSuchBlockError{ptr.ID}.Error())

	err = bcache.DeletePermanent(id)
	require.NoError(t, err)

	_, err = bcache.CheckForKnownPtr(tlf, block.(*FileBlock))
	require.NoError(t, err)
}

func TestBlockCacheEvictOnBytes(t *testing.T) {
	// Make a cache that can only handle 5 bytes
	bcache := blockCacheTestInit(t, 1000, 5)

	tlf := tlf.FakeID(1, tlf.Private)
	for i := byte(0); i < 8; i++ {
		block := &FileBlock{
			Contents: make([]byte, 1),
		}
		id := kbfsblock.FakeID(i)
		ptr := BlockPointer{ID: id}

		err := bcache.Put(ptr, tlf, block, TransientEntry, SkipCacheHash)
		require.NoError(t, err)
	}

	// Only blocks 3 through 7 should be left
	for i := byte(0); i < 3; i++ {
		id := kbfsblock.FakeID(i)
		testExpectedMissing(t, id, bcache)
	}

	for i := byte(3); i < 8; i++ {
		id := kbfsblock.FakeID(i)
		_, err := bcache.Get(BlockPointer{ID: id})
		require.NoError(t, err)
	}
}

func TestBlockCacheEvictIncludesPermanentSize(t *testing.T) {
	// Make a cache that can only handle 5 bytes
	bcache := blockCacheTestInit(t, 1000, 5)

	tlf := tlf.FakeID(1, tlf.Private)
	idPerm := kbfsblock.FakeID(0)
	ptr := BlockPointer{ID: idPerm}
	block := &FileBlock{
		Contents: make([]byte, 2),
	}
	err := bcache.Put(ptr, tlf, block, PermanentEntry, SkipCacheHash)
	require.NoError(t, err)

	for i := byte(1); i < 8; i++ {
		block := &FileBlock{
			Contents: make([]byte, 1),
		}
		id := kbfsblock.FakeID(i)
		ptr := BlockPointer{ID: id}

		err := bcache.Put(ptr, tlf, block, TransientEntry, SkipCacheHash)
		require.NoError(t, err)
	}

	// The permanent block shouldn't be evicted
	_, err = bcache.Get(BlockPointer{ID: idPerm})
	require.NoError(t, err)

	// Only transient blocks 5 through 7 should be left
	for i := byte(1); i < 5; i++ {
		id := kbfsblock.FakeID(i)
		testExpectedMissing(t, id, bcache)
	}

	for i := byte(5); i < 8; i++ {
		id := kbfsblock.FakeID(i)
		_, err := bcache.Get(BlockPointer{ID: id})
		require.NoError(t, err)
	}

	// Try putting in a block that's too big
	block = &FileBlock{
		CommonBlock: CommonBlock{IsInd: true},
	}
	block.SetEncodedSize(7)
	id := kbfsblock.FakeID(8)
	ptr = BlockPointer{ID: id}
	err = bcache.Put(ptr, tlf, block, TransientEntry, SkipCacheHash)
	require.EqualError(t, err, CachePutCacheFullError{ptr.ID}.Error())

	// All transient blocks should be gone (including the new one)
	_, err = bcache.Get(BlockPointer{ID: idPerm})
	require.NoError(t, err)

	// Only transient blocks 5 through 7 should be left
	for i := byte(1); i < 9; i++ {
		id := kbfsblock.FakeID(i)
		testExpectedMissing(t, id, bcache)
	}

	// Now try putting in a permanent block that exceeds capacity,
	// which should always succeed.
	idPerm2 := kbfsblock.FakeID(9)
	ptr2 := BlockPointer{ID: idPerm2}
	block2 := &FileBlock{
		Contents: make([]byte, 10),
	}
	err = bcache.Put(ptr2, tlf, block2, PermanentEntry, SkipCacheHash)
	require.NoError(t, err)

	_, err = bcache.Get(BlockPointer{ID: idPerm})
	require.NoError(t, err)
	_, err = bcache.Get(BlockPointer{ID: idPerm2})
	require.NoError(t, err)
}

func TestBlockCachePutNoHashCalculation(t *testing.T) {
	bcache := blockCacheTestInit(t, 100, 1<<30)
	ptr := BlockPointer{ID: kbfsblock.FakeID(1)}
	tlf := tlf.FakeID(1, tlf.Private)
	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}

	// this is an invalid hash; if Put() does not calculate hash, it should go
	// into the cache
	hash := &kbfshash.RawDefaultHash{}
	block.hash = hash
	err := bcache.Put(ptr, tlf, block, TransientEntry, DoCacheHash)
	require.NoError(t, err)

	// CheckForKnownPtr() calculates hash only if it's nil. If the block with
	// invalid hash was put into cache, this will find it.
	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block)
	require.NoError(t, err)
	require.Equal(t, ptr, checkedPtr)
	require.Equal(t, hash, block.hash)
}

func TestBlockCacheDoublePut(t *testing.T) {
	cache := blockCacheTestInit(t, 1, 1<<30)
	id1 := kbfsblock.FakeID(1)
	id2 := kbfsblock.FakeID(2)
	buf := make([]byte, 16)
	_, err := rand.Read(buf)
	require.NoError(t, err)
	block := &FileBlock{
		Contents: buf,
	}
	bytes := uint64(len(block.Contents))

	t.Log("Put a block into the cache. Check that the cache calculated its byte usage correctly.")
	testBcachePutWithBlock(t, id1, cache, TransientEntry, block)
	require.Equal(t, bytes, cache.cleanTotalBytes)

	t.Log("Put the same block into the cache. Check that the cache's byte usage hasn't changed.")
	testBcachePutWithBlock(t, id1, cache, TransientEntry, block)
	require.Equal(t, bytes, cache.cleanTotalBytes)

	t.Log("Put a new block into the cache, evicting the first one. Check that the byte usage is updated correctly.")
	block = NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4, 5}
	bytes = uint64(len(block.Contents))
	testBcachePutWithBlock(t, id2, cache, TransientEntry, block)
	require.Equal(t, bytes, cache.cleanTotalBytes)
}
