package libkbfs

import (
	"testing"
)

func testBcachePut(t *testing.T, id BlockID, bcache BlockCache, dirty bool) {
	block := NewFileBlock()
	ptr := BlockPointer{ID: id}
	branch := MasterBranch

	// put the block
	if dirty {
		if err := bcache.PutDirty(ptr, branch, block); err != nil {
			t.Errorf("Got error on PutDirty for block %s: %v", id, err)
		}
	} else {
		if err := bcache.Put(id, block); err != nil {
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
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on 1st get: %v", err)
	}
}

func TestBcachePut(t *testing.T) {
	testBcachePut(t, BlockID{1}, NewBlockCacheStandard(100), false)
}

func TestBcachePutDirty(t *testing.T) {
	testBcachePut(t, BlockID{1}, NewBlockCacheStandard(100), true)
}

func TestBcachePutPastCapacity(t *testing.T) {
	bcache := NewBlockCacheStandard(2)
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
	bcache := NewBlockCacheStandard(2)
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

func TestBcacheDelete(t *testing.T) {
	bcache := NewBlockCacheStandard(100)

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
	bcache := NewBlockCacheStandard(100)

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

func TestBcacheFinalize(t *testing.T) {
	bcache := NewBlockCacheStandard(100)

	id1 := BlockID{1}
	id2 := BlockID{2}
	testBcachePut(t, id1, bcache, true)

	if err := bcache.Finalize(
		BlockPointer{ID: id1}, MasterBranch, id2); err != nil {
		t.Errorf("Couldnt finalize: %v", err)
	}
	testExpectedMissing(t, id1, bcache)

	// 2 should be there now, and be not-dirty
	if _, err := bcache.Get(BlockPointer{ID: id2}, MasterBranch); err != nil {
		t.Errorf("Got unexpected error on 2nd get: %v", err)
	} else if bcache.IsDirty(BlockPointer{ID: id2}, MasterBranch) {
		t.Errorf("Finalized block is still dirty")
	}
}
