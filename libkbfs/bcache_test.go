package libkbfs

import (
	"testing"
)

func testBcachePut(t *testing.T, id BlockId, bcache BlockCache, dirty bool) {
	block := NewFileBlock()

	// put the block
	if err := bcache.Put(id, block, dirty); err != nil {
		t.Errorf("Got error on put on block %s: %v", id, err)
	}

	// make sure we can get it successfully
	if block2, err := bcache.Get(id); err != nil {
		t.Errorf("Got error on get for block %s: %v", id, err)
	} else if block2 != block {
		t.Errorf("Got back unexpected block: %v", block2)
	}

	// make sure its dirty status is right
	if bcache.IsDirty(id) != dirty {
		t.Errorf("Wrong dirty status for block %s", id)
	}
}

func testExpectedMissing(t *testing.T, id BlockId, bcache BlockCache) {
	expectedErr := NoSuchBlockError{id}
	if _, err := bcache.Get(id); err == nil {
		t.Errorf("No expected error on 1st get: %v", err)
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on 1st get: %v", err)
	}
}

func TestBcachePut(t *testing.T) {
	testBcachePut(t, BlockId{1}, NewBlockCacheStandard(100), false)
}

func TestBcachePutDirty(t *testing.T) {
	testBcachePut(t, BlockId{1}, NewBlockCacheStandard(100), true)
}

func TestBcachePutPastCapacity(t *testing.T) {
	bcache := NewBlockCacheStandard(2)
	id1 := BlockId{1}
	testBcachePut(t, id1, bcache, false)
	id2 := BlockId{2}
	testBcachePut(t, id2, bcache, false)
	testBcachePut(t, BlockId{3}, bcache, false)

	// now block 1 should have been kicked out
	testExpectedMissing(t, id1, bcache)

	// but 2 should still be there
	if _, err := bcache.Get(id2); err != nil {
		t.Errorf("Got unexpected error on 2nd get: %v", err)
	}

	// dirty blocks don't count
	testBcachePut(t, BlockId{4}, bcache, true)
	testBcachePut(t, BlockId{5}, bcache, true)
	testBcachePut(t, BlockId{6}, bcache, true)
	testBcachePut(t, BlockId{7}, bcache, true)

	// 2 should still be there
	if _, err := bcache.Get(id2); err != nil {
		t.Errorf("Got unexpected error on 2nd get: %v", err)
	}
}

func TestBcacheDelete(t *testing.T) {
	bcache := NewBlockCacheStandard(100)

	id1 := BlockId{1}
	testBcachePut(t, id1, bcache, false)
	id2 := BlockId{2}
	testBcachePut(t, id2, bcache, false)

	bcache.Delete(id1)
	testExpectedMissing(t, id1, bcache)

	// 2 should still be there
	if _, err := bcache.Get(id2); err != nil {
		t.Errorf("Got unexpected error on 2nd get: %v", err)
	}
}

func TestBcacheDeleteDirty(t *testing.T) {
	bcache := NewBlockCacheStandard(100)

	id1 := BlockId{1}
	testBcachePut(t, id1, bcache, true)
	id2 := BlockId{2}
	testBcachePut(t, id2, bcache, false)

	bcache.Delete(id1)
	testExpectedMissing(t, id1, bcache)

	// 2 should still be there
	if _, err := bcache.Get(id2); err != nil {
		t.Errorf("Got unexpected error on 2nd get: %v", err)
	}
}

func TestBcacheFinalize(t *testing.T) {
	bcache := NewBlockCacheStandard(100)

	id1 := BlockId{1}
	id2 := BlockId{2}
	testBcachePut(t, id1, bcache, true)

	if err := bcache.Finalize(id1, id2); err != nil {
		t.Errorf("Couldnt finalize: %v", err)
	}
	testExpectedMissing(t, id1, bcache)

	// 2 should be there now, and be not-dirty
	if _, err := bcache.Get(id2); err != nil {
		t.Errorf("Got unexpected error on 2nd get: %v", err)
	} else if bcache.IsDirty(id2) {
		t.Errorf("Finalized block is still dirty")
	}
}
