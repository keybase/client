package libkbfs

import (
	"testing"
)

func blockCacheTestInit(t *testing.T, capacity int) *BlockCacheStandard {
	config := MakeTestConfigOrBust(t, nil, "test")
	b := NewBlockCacheStandard(config, capacity)
	config.SetBlockCache(b)
	return b
}

func testBcachePut(t *testing.T, id BlockID, bcache BlockCache, dirty bool) {
	block := NewFileBlock()
	ptr := BlockPointer{ID: id}
	tlf := TlfID{1}
	branch := MasterBranch

	// put the block
	if dirty {
		if err := bcache.PutDirty(ptr, branch, block); err != nil {
			t.Errorf("Got error on PutDirty for block %s: %v", id, err)
		}
	} else {
		if err := bcache.Put(ptr, tlf, block); err != nil {
			t.Errorf("Got error on Put for block %s: %v", id, err)
		}
	}

	// make sure we can get it successfully
	if block2, err := bcache.Get(ptr, branch); err != nil {
		t.Errorf("Got error on get for block %s: %v", id, err)
	} else if block2 != block {
		t.Errorf("Got back unexpected block: %v", block2)
	}

	// make sure its dirty status is right
	if bcache.IsDirty(ptr, branch) != dirty {
		t.Errorf("Wrong dirty status for block %s", id)
	}
}

func testExpectedMissing(t *testing.T, id BlockID, bcache BlockCache) {
	expectedErr := NoSuchBlockError{id}
	ptr := BlockPointer{ID: id}
	if _, err := bcache.Get(ptr, MasterBranch); err == nil {
		t.Errorf("No expected error on 1st get: %v", err)
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on 1st get: %v", err)
	}
}

func TestBcachePut(t *testing.T) {
	testBcachePut(t, BlockID{1}, blockCacheTestInit(t, 100), false)
}

func TestBcachePutDirty(t *testing.T) {
	testBcachePut(t, BlockID{1}, blockCacheTestInit(t, 100), true)
}

func TestBcachePutPastCapacity(t *testing.T) {
	bcache := blockCacheTestInit(t, 2)
	id1 := BlockID{1}
	testBcachePut(t, id1, bcache, false)
	id2 := BlockID{2}
	testBcachePut(t, id2, bcache, false)
	testBcachePut(t, BlockID{3}, bcache, false)

	// now block 1 should have been kicked out
	testExpectedMissing(t, id1, bcache)

	// but 2 should still be there
	if _, err := bcache.Get(BlockPointer{ID: id2}, MasterBranch); err != nil {
		t.Errorf("Got unexpected error on 2nd get: %v", err)
	}

	// dirty blocks don't count
	testBcachePut(t, BlockID{4}, bcache, true)
	testBcachePut(t, BlockID{5}, bcache, true)
	testBcachePut(t, BlockID{6}, bcache, true)
	testBcachePut(t, BlockID{7}, bcache, true)

	// 2 should still be there
	if _, err := bcache.Get(BlockPointer{ID: id2}, MasterBranch); err != nil {
		t.Errorf("Got unexpected error on 2nd get: %v", err)
	}
}

func TestBcachePutDuplicateDirty(t *testing.T) {
	bcache := blockCacheTestInit(t, 2)
	// put one under the default block pointer and branch name (clean)
	id1 := BlockID{1}
	testBcachePut(t, id1, bcache, false)
	cleanBranch := MasterBranch

	// Then dirty a different reference nonce, and make sure the
	// original is still clean
	newNonce := BlockRefNonce([8]byte{1, 0, 0, 0, 0, 0, 0, 0})
	newNonceBlock := NewFileBlock()
	err := bcache.PutDirty(BlockPointer{ID: id1, RefNonce: newNonce},
		MasterBranch, newNonceBlock)
	if err != nil {
		t.Errorf("Unexpected error on PutDirty: %v", err)
	}

	// make sure the original dirty status is right
	if bcache.IsDirty(BlockPointer{ID: id1}, cleanBranch) {
		t.Errorf("Original block is now unexpectedly dirty")
	}
	if !bcache.IsDirty(BlockPointer{ID: id1, RefNonce: newNonce}, cleanBranch) {
		t.Errorf("New refnonce block is now unexpectedly clean")
	}

	// Then dirty a different branch, and make sure the
	// original is still clean
	newBranch := BranchName("dirtyBranch")
	newBranchBlock := NewFileBlock()
	err = bcache.PutDirty(BlockPointer{ID: id1}, newBranch, newBranchBlock)
	if err != nil {
		t.Errorf("Unexpected error on PutDirty: %v", err)
	}

	// make sure the original dirty status is right
	if bcache.IsDirty(BlockPointer{ID: id1}, cleanBranch) {
		t.Errorf("Original block is now unexpectedly dirty")
	}
	if !bcache.IsDirty(BlockPointer{ID: id1, RefNonce: newNonce}, cleanBranch) {
		t.Errorf("New refnonce block is now unexpectedly clean")
	}
	if !bcache.IsDirty(BlockPointer{ID: id1}, newBranch) {
		t.Errorf("New branch block is now unexpectedly clean")
	}
}

func TestBcacheCheckPtrSuccess(t *testing.T) {
	bcache := blockCacheTestInit(t, 100)

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := BlockID{1}
	ptr := BlockPointer{ID: id}
	tlf := TlfID{1}

	err := bcache.Put(ptr, tlf, block)
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

func TestBcacheCheckPtrNotFound(t *testing.T) {
	bcache := blockCacheTestInit(t, 100)

	block := NewFileBlock().(*FileBlock)
	block.Contents = []byte{1, 2, 3, 4}
	id := BlockID{1}
	ptr := BlockPointer{ID: id}
	tlf := TlfID{1}

	err := bcache.Put(ptr, tlf, block)
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

func TestBcacheDelete(t *testing.T) {
	bcache := blockCacheTestInit(t, 100)

	id1 := BlockID{1}
	testBcachePut(t, id1, bcache, false)
	id2 := BlockID{2}
	testBcachePut(t, id2, bcache, false)

	bcache.Delete(id1)
	testExpectedMissing(t, id1, bcache)

	// 2 should still be there
	if _, err := bcache.Get(BlockPointer{ID: id2}, MasterBranch); err != nil {
		t.Errorf("Got unexpected error on 2nd get: %v", err)
	}
}

func TestBcacheDeleteDirty(t *testing.T) {
	bcache := blockCacheTestInit(t, 100)

	id1 := BlockID{1}
	testBcachePut(t, id1, bcache, true)
	id2 := BlockID{2}
	testBcachePut(t, id2, bcache, false)

	bcache.DeleteDirty(BlockPointer{ID: id1}, MasterBranch)
	testExpectedMissing(t, id1, bcache)

	// 2 should still be there
	if _, err := bcache.Get(BlockPointer{ID: id2}, MasterBranch); err != nil {
		t.Errorf("Got unexpected error on 2nd get: %v", err)
	}
}
