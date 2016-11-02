// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/kbfs/kbfshash"
	"github.com/keybase/kbfs/tlf"
)

func blockCacheTestInit(t *testing.T, capacity int,
	bytesCapacity uint64) Config {
	b := NewBlockCacheStandard(capacity, bytesCapacity)
	config := MakeTestConfigOrBust(t, "test")
	config.SetBlockCache(b)
	return config
}

func testBcachePutWithBlock(t *testing.T, id BlockID, bcache BlockCache, lifetime BlockCacheLifetime, block Block) {
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, false)

	// put the block
	if err := bcache.Put(ptr, tlf, block, lifetime); err != nil {
		t.Errorf("Got error on Put for block %s: %v", id, err)
	}

	// make sure we can get it successfully
	if block2, err := bcache.Get(ptr); err != nil {
		t.Errorf("Got error on get for block %s: %v", id, err)
	} else if block2 != block {
		t.Errorf("Got %v, expected %v", block2, block)
	}
}

func testBcachePut(t *testing.T, id BlockID, bcache BlockCache, lifetime BlockCacheLifetime) {
	block := NewFileBlock()
	testBcachePutWithBlock(t, id, bcache, lifetime, block)
}

func testExpectedMissing(t *testing.T, id BlockID, bcache BlockCache) {
	expectedErr := NoSuchBlockError{id}
	ptr := BlockPointer{ID: id}
	if _, err := bcache.Get(ptr); err == nil {
		t.Errorf("No expected error on 1st get: %v", err)
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on 1st get: %v", err)
	}
}

func TestBcachePut(t *testing.T) {
	config := blockCacheTestInit(t, 100, 1<<30)
	defer CheckConfigAndShutdown(t, config)
	testBcachePut(t, fakeBlockID(1), config.BlockCache(), TransientEntry)
	testBcachePut(t, fakeBlockID(2), config.BlockCache(), PermanentEntry)
}

func TestBcachePutPastCapacity(t *testing.T) {
	config := blockCacheTestInit(t, 2, 1<<30)
	defer CheckConfigAndShutdown(t, config)
	bcache := config.BlockCache()
	id1 := fakeBlockID(1)
	testBcachePut(t, id1, bcache, TransientEntry)
	id2 := fakeBlockID(2)
	testBcachePut(t, id2, bcache, TransientEntry)
	testBcachePut(t, fakeBlockID(3), bcache, TransientEntry)

	// now block 1 should have been kicked out
	testExpectedMissing(t, id1, bcache)

	// but 2 should still be there
	if _, err := bcache.Get(BlockPointer{ID: id2}); err != nil {
		t.Errorf("Got unexpected error on 2nd get: %v", err)
	}

	// permanent blocks don't count
	testBcachePut(t, fakeBlockID(4), config.BlockCache(), PermanentEntry)
}

func TestBcacheCheckPtrSuccess(t *testing.T) {
	config := blockCacheTestInit(t, 100, 1<<30)
	defer CheckConfigAndShutdown(t, config)
	bcache := config.BlockCache()

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := fakeBlockID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, false)

	err := bcache.Put(ptr, tlf, block, TransientEntry)
	if err != nil {
		t.Errorf("Couldn't put block: %v", err)
	}

	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block)
	if err != nil {
		t.Errorf("Unexpected error checking id: %v", err)
	} else if checkedPtr != ptr {
		t.Errorf("Unexpected pointer; got %v, expected %v", checkedPtr, id)
	}
}

func TestBcacheCheckPtrPermanent(t *testing.T) {
	config := blockCacheTestInit(t, 100, 1<<30)
	defer config.Shutdown()
	bcache := config.BlockCache()

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := fakeBlockID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, false)

	err := bcache.Put(ptr, tlf, block, PermanentEntry)
	if err != nil {
		t.Errorf("Couldn't put block: %v", err)
	}

	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block)
	if err != nil {
		t.Errorf("Unexpected error checking id: %v", err)
	} else if checkedPtr != (BlockPointer{}) {
		t.Errorf("Unexpected non-zero pointer %v", checkedPtr)
	}
}

func TestBcacheCheckPtrNotFound(t *testing.T) {
	config := blockCacheTestInit(t, 100, 1<<30)
	defer CheckConfigAndShutdown(t, config)
	bcache := config.BlockCache()

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := fakeBlockID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, false)

	err := bcache.Put(ptr, tlf, block, TransientEntry)
	if err != nil {
		t.Errorf("Couldn't put block: %v", err)
	}

	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{4, 3, 2, 1}
	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block2)
	if err != nil {
		t.Errorf("Unexpected error checking id: %v", err)
	} else if checkedPtr.IsInitialized() {
		t.Errorf("Unexpected ID; got %v, expected null", checkedPtr)
	}
}

func TestBcacheDeleteTransient(t *testing.T) {
	config := blockCacheTestInit(t, 100, 1<<30)
	defer CheckConfigAndShutdown(t, config)
	bcache := config.BlockCache()

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := fakeBlockID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, false)

	err := bcache.Put(ptr, tlf, block, TransientEntry)
	if err != nil {
		t.Errorf("Couldn't put block: %v", err)
	}

	if err := bcache.DeleteTransient(ptr, tlf); err != nil {
		t.Fatalf("Couldn't delete transient: %v", err)
	}

	// Make sure the pointer is gone from the hash cache too.
	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block)
	if err != nil {
		t.Errorf("Unexpected error checking id: %v", err)
	} else if checkedPtr.IsInitialized() {
		t.Errorf("Unexpected ID; got %v, expected null", checkedPtr)
	}
}

func TestBcacheDeletePermanent(t *testing.T) {
	config := blockCacheTestInit(t, 100, 1<<30)
	defer CheckConfigAndShutdown(t, config)
	bcache := config.BlockCache()

	id1 := fakeBlockID(1)
	testBcachePut(t, id1, bcache, PermanentEntry)

	id2 := fakeBlockID(2)
	block2 := NewFileBlock()
	testBcachePutWithBlock(t, id2, bcache, TransientEntry, block2)
	testBcachePutWithBlock(t, id2, bcache, PermanentEntry, block2)

	bcache.DeletePermanent(id1)
	bcache.DeletePermanent(id2)
	testExpectedMissing(t, id1, bcache)

	// 2 should still be there
	if _, err := bcache.Get(BlockPointer{ID: id2}); err != nil {
		t.Errorf("Got unexpected error on 2nd get: %v", err)
	}
}

func TestBcacheEmptyTransient(t *testing.T) {
	config := blockCacheTestInit(t, 0, 1<<30)
	defer config.Shutdown()

	bcache := config.BlockCache()

	block := NewFileBlock()
	id := fakeBlockID(1)
	ptr := BlockPointer{ID: id}
	tlf := tlf.FakeID(1, false)

	// Make sure all the operations work even if the cache has no
	// transient capacity.

	if err := bcache.Put(ptr, tlf, block, TransientEntry); err != nil {
		t.Errorf("Got error on Put for block %s: %v", id, err)
	}

	_, err := bcache.Get(ptr)
	if _, ok := err.(NoSuchBlockError); !ok {
		t.Errorf("Got unexpected error %v", err)
	}

	err = bcache.DeletePermanent(id)
	if err != nil {
		t.Errorf("Got unexpected error %v", err)
	}

	_, err = bcache.CheckForKnownPtr(tlf, block.(*FileBlock))
	if err != nil {
		t.Errorf("Got unexpected error %v", err)
	}
}

func TestBcacheEvictOnBytes(t *testing.T) {
	// Make a cache that can only handle 5 bytes
	config := blockCacheTestInit(t, 1000, 5)
	defer config.Shutdown()

	bcache := config.BlockCache()

	tlf := tlf.FakeID(1, false)
	for i := byte(0); i < 8; i++ {
		block := &FileBlock{
			Contents: make([]byte, 1),
		}
		id := fakeBlockID(i)
		ptr := BlockPointer{ID: id}

		if err := bcache.Put(ptr, tlf, block, TransientEntry); err != nil {
			t.Errorf("Got error on Put for block %s: %v", id, err)
		}
	}

	// Only blocks 3 through 7 should be left
	for i := byte(0); i < 3; i++ {
		id := fakeBlockID(i)
		testExpectedMissing(t, id, bcache)
	}

	for i := byte(3); i < 8; i++ {
		id := fakeBlockID(i)
		if _, err := bcache.Get(BlockPointer{ID: id}); err != nil {
			t.Errorf("Got unexpected error on get: %v", err)
		}
	}
}

func TestBcacheEvictIncludesPermanentSize(t *testing.T) {
	// Make a cache that can only handle 5 bytes
	config := blockCacheTestInit(t, 1000, 5)
	defer config.Shutdown()

	bcache := config.BlockCache()

	tlf := tlf.FakeID(1, false)
	idPerm := fakeBlockID(0)
	ptr := BlockPointer{ID: idPerm}
	block := &FileBlock{
		Contents: make([]byte, 2),
	}
	if err := bcache.Put(ptr, tlf, block, PermanentEntry); err != nil {
		t.Errorf("Got error on Put for block %s: %v", idPerm, err)
	}

	for i := byte(1); i < 8; i++ {
		block := &FileBlock{
			Contents: make([]byte, 1),
		}
		id := fakeBlockID(i)
		ptr := BlockPointer{ID: id}

		if err := bcache.Put(ptr, tlf, block, TransientEntry); err != nil {
			t.Errorf("Got error on Put for block %s: %v", id, err)
		}
	}

	// The permanent block shouldn't be evicted
	if _, err := bcache.Get(BlockPointer{ID: idPerm}); err != nil {
		t.Errorf("Got unexpected error on get: %v", err)
	}

	// Only transient blocks 5 through 7 should be left
	for i := byte(1); i < 5; i++ {
		id := fakeBlockID(i)
		testExpectedMissing(t, id, bcache)
	}

	for i := byte(5); i < 8; i++ {
		id := fakeBlockID(i)
		if _, err := bcache.Get(BlockPointer{ID: id}); err != nil {
			t.Errorf("Got unexpected error on get: %v", err)
		}
	}

	// Try putting in a block that's too big
	block = &FileBlock{
		CommonBlock: CommonBlock{IsInd: true},
	}
	block.SetEncodedSize(7)
	id := fakeBlockID(8)
	ptr = BlockPointer{ID: id}
	if err := bcache.Put(ptr, tlf, block, TransientEntry); err != nil {
		t.Errorf("Got error on Put for block %s: %v", id, err)
	}

	// All transient blocks should be gone (including the new one)
	if _, err := bcache.Get(BlockPointer{ID: idPerm}); err != nil {
		t.Errorf("Got unexpected error on get: %v", err)
	}

	// Only transient blocks 5 through 7 should be left
	for i := byte(1); i < 9; i++ {
		id := fakeBlockID(i)
		testExpectedMissing(t, id, bcache)
	}

	// Now try putting in a permanent block that exceeds capacity,
	// which should always succeed.
	idPerm2 := fakeBlockID(9)
	ptr2 := BlockPointer{ID: idPerm2}
	block2 := &FileBlock{
		Contents: make([]byte, 10),
	}
	if err := bcache.Put(ptr2, tlf, block2, PermanentEntry); err != nil {
		t.Errorf("Got error on Put for block %s: %v", idPerm, err)
	}

	if _, err := bcache.Get(BlockPointer{ID: idPerm}); err != nil {
		t.Errorf("Got unexpected error on get: %v", err)
	}
	if _, err := bcache.Get(BlockPointer{ID: idPerm2}); err != nil {
		t.Errorf("Got unexpected error on get: %v", err)
	}
}

func TestPutNoHashCalculation(t *testing.T) {
	config := blockCacheTestInit(t, 100, 1<<30)
	defer CheckConfigAndShutdown(t, config)
	bcache := config.BlockCache()
	ptr := BlockPointer{ID: fakeBlockID(1)}
	tlf := tlf.FakeID(1, false)
	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}

	// this is an invalid hash; if Put() does not calculate hash, it should go
	// into the cache
	block.hash = &kbfshash.RawDefaultHash{}
	if err := bcache.Put(ptr, tlf, block, TransientEntry); err != nil {
		t.Errorf("Got error on Put for block %s: %v", ptr.ID, err)
	}

	// CheckForKnownPtr() calculates hash, which results in a valid hash at
	// block.hash. If the block with invalid hash was put into cache, this should
	// fail to find the block.
	checkedPtr, err := bcache.CheckForKnownPtr(tlf, block)
	if err != nil {
		t.Errorf("Unexpected error checking id: %v", err)
	} else if checkedPtr == ptr {
		t.Errorf("Put() is calculating hash")
	}
}
