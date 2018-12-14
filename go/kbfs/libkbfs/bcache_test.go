// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func blockCacheTestInit(t *testing.T, capacity int,
	bytesCapacity uint64) Config {
	b := NewBlockCacheStandard(capacity, bytesCapacity)
	config := MakeTestConfigOrBust(t, "test")
	config.SetBlockCache(b)
	return config
}

func testBcachePutWithBlock(t *testing.T, id kbfsblock.ID, bcache BlockCache, lifetime BlockCacheLifetime, block Block) {
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, tlf.Private)

	// put the block
	err := bcache.Put(ptr, tlf, block, lifetime)
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
	ctx := context.Background()
	config := blockCacheTestInit(t, 100, 1<<30)
	defer CheckConfigAndShutdown(ctx, t, config)
	testBcachePut(t, kbfsblock.FakeID(1), config.BlockCache(), TransientEntry)
	testBcachePut(t, kbfsblock.FakeID(2), config.BlockCache(), PermanentEntry)
}

func TestBlockCachePutPastCapacity(t *testing.T) {
	ctx := context.Background()
	config := blockCacheTestInit(t, 2, 1<<30)
	defer CheckConfigAndShutdown(ctx, t, config)
	bcache := config.BlockCache()
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
	testBcachePut(t, kbfsblock.FakeID(4), config.BlockCache(), PermanentEntry)
}

func TestBlockCacheCheckPtrSuccess(t *testing.T) {
	ctx := context.Background()
	config := blockCacheTestInit(t, 100, 1<<30)
	defer CheckConfigAndShutdown(ctx, t, config)
	bcache := config.BlockCache()

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := kbfsblock.FakeID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, tlf.Private)

	err := bcache.Put(ptr, tlf, block, TransientEntry)
	require.NoError(t, err)

	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block)
	require.NoError(t, err)
	require.Equal(t, ptr, checkedPtr)
}

func TestBlockCacheCheckPtrPermanent(t *testing.T) {
	ctx := context.Background()
	config := blockCacheTestInit(t, 100, 1<<30)
	defer config.Shutdown(ctx)
	bcache := config.BlockCache()

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := kbfsblock.FakeID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, tlf.Private)

	err := bcache.Put(ptr, tlf, block, PermanentEntry)
	require.NoError(t, err)

	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block)
	require.NoError(t, err)
	require.Equal(t, BlockPointer{}, checkedPtr)
}

func TestBlockCacheCheckPtrNotFound(t *testing.T) {
	ctx := context.Background()
	config := blockCacheTestInit(t, 100, 1<<30)
	defer CheckConfigAndShutdown(ctx, t, config)
	bcache := config.BlockCache()

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := kbfsblock.FakeID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, tlf.Private)

	err := bcache.Put(ptr, tlf, block, TransientEntry)
	require.NoError(t, err)

	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{4, 3, 2, 1}
	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block2)
	require.NoError(t, err)
	require.False(t, checkedPtr.IsInitialized())
}

func TestBlockCacheDeleteTransient(t *testing.T) {
	ctx := context.Background()
	config := blockCacheTestInit(t, 100, 1<<30)
	defer CheckConfigAndShutdown(ctx, t, config)
	bcache := config.BlockCache()

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := kbfsblock.FakeID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, tlf.Private)

	err := bcache.Put(ptr, tlf, block, TransientEntry)
	require.NoError(t, err)

	err = bcache.DeleteTransient(ptr, tlf)
	require.NoError(t, err)

	// Make sure the pointer is gone from the hash cache too.
	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block)
	require.NoError(t, err)
	require.False(t, checkedPtr.IsInitialized())
}

func TestBlockCacheDeletePermanent(t *testing.T) {
	ctx := context.Background()
	config := blockCacheTestInit(t, 100, 1<<30)
	defer CheckConfigAndShutdown(ctx, t, config)
	bcache := config.BlockCache()

	id1 := kbfsblock.FakeID(1)
	testBcachePut(t, id1, bcache, PermanentEntry)

	id2 := kbfsblock.FakeID(2)
	block2 := NewFileBlock()
	testBcachePutWithBlock(t, id2, bcache, TransientEntry, block2)
	testBcachePutWithBlock(t, id2, bcache, PermanentEntry, block2)

	bcache.DeletePermanent(id1)
	bcache.DeletePermanent(id2)
	testExpectedMissing(t, id1, bcache)

	// 2 should still be there
	_, err := bcache.Get(BlockPointer{ID: id2})
	require.NoError(t, err)
}

func TestBlockCacheEmptyTransient(t *testing.T) {
	ctx := context.Background()
	config := blockCacheTestInit(t, 0, 1<<30)
	defer config.Shutdown(ctx)

	bcache := config.BlockCache()

	block := NewFileBlock()
	id := kbfsblock.FakeID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, tlf.Private)

	// Make sure all the operations work even if the cache has no
	// transient capacity.

	err := bcache.Put(ptr, tlf, block, TransientEntry)
	require.NoError(t, err)

	_, err = bcache.Get(ptr)
	require.EqualError(t, err, NoSuchBlockError{ptr.ID}.Error())

	err = bcache.DeletePermanent(id)
	require.NoError(t, err)

	_, err = bcache.CheckForKnownPtr(tlf, block.(*FileBlock))
	require.NoError(t, err)
}

func TestBlockCacheEvictOnBytes(t *testing.T) {
	ctx := context.Background()
	// Make a cache that can only handle 5 bytes
	config := blockCacheTestInit(t, 1000, 5)
	defer config.Shutdown(ctx)

	bcache := config.BlockCache()

	tlf := tlf.FakeID(1, tlf.Private)
	for i := byte(0); i < 8; i++ {
		block := &FileBlock{
			Contents: make([]byte, 1),
		}
		id := kbfsblock.FakeID(i)
		ptr := BlockPointer{ID: id}

		err := bcache.Put(ptr, tlf, block, TransientEntry)
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
	ctx := context.Background()
	// Make a cache that can only handle 5 bytes
	config := blockCacheTestInit(t, 1000, 5)
	defer config.Shutdown(ctx)

	bcache := config.BlockCache()

	tlf := tlf.FakeID(1, tlf.Private)
	idPerm := kbfsblock.FakeID(0)
	ptr := BlockPointer{ID: idPerm}
	block := &FileBlock{
		Contents: make([]byte, 2),
	}
	err := bcache.Put(ptr, tlf, block, PermanentEntry)
	require.NoError(t, err)

	for i := byte(1); i < 8; i++ {
		block := &FileBlock{
			Contents: make([]byte, 1),
		}
		id := kbfsblock.FakeID(i)
		ptr := BlockPointer{ID: id}

		err := bcache.Put(ptr, tlf, block, TransientEntry)
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
	err = bcache.Put(ptr, tlf, block, TransientEntry)
	require.EqualError(t, err, cachePutCacheFullError{ptr.ID}.Error())

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
	err = bcache.Put(ptr2, tlf, block2, PermanentEntry)
	require.NoError(t, err)

	_, err = bcache.Get(BlockPointer{ID: idPerm})
	require.NoError(t, err)
	_, err = bcache.Get(BlockPointer{ID: idPerm2})
	require.NoError(t, err)
}

func TestBlockCachePutNoHashCalculation(t *testing.T) {
	ctx := context.Background()
	config := blockCacheTestInit(t, 100, 1<<30)
	defer CheckConfigAndShutdown(ctx, t, config)
	bcache := config.BlockCache()
	ptr := BlockPointer{ID: kbfsblock.FakeID(1)}
	tlf := tlf.FakeID(1, tlf.Private)
	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}

	// this is an invalid hash; if Put() does not calculate hash, it should go
	// into the cache
	hash := &kbfshash.RawDefaultHash{}
	block.hash = hash
	err := bcache.Put(ptr, tlf, block, TransientEntry)
	require.NoError(t, err)

	// CheckForKnownPtr() calculates hash only if it's nil. If the block with
	// invalid hash was put into cache, this will find it.
	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block)
	require.NoError(t, err)
	require.Equal(t, ptr, checkedPtr)
	require.Equal(t, hash, block.hash)
}

func TestBlockCacheDoublePut(t *testing.T) {
	ctx := context.Background()
	config := blockCacheTestInit(t, 1, 1<<30)
	defer CheckConfigAndShutdown(ctx, t, config)
	cache := config.BlockCache().(*BlockCacheStandard)
	id1 := kbfsblock.FakeID(1)
	id2 := kbfsblock.FakeID(2)
	block := makeFakeFileBlock(t, false)
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
