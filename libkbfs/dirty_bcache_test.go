// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "testing"

func testDirtyBcachePut(t *testing.T, id BlockID, dirtyBcache DirtyBlockCache) {
	block := NewFileBlock()
	ptr := BlockPointer{ID: id}
	branch := MasterBranch

	// put the block
	if err := dirtyBcache.Put(ptr, branch, block); err != nil {
		t.Errorf("Got error on Put for block %s: %v", id, err)
	}

	// make sure we can get it successfully
	if block2, err := dirtyBcache.Get(ptr, branch); err != nil {
		t.Errorf("Got error on get for block %s: %v", id, err)
	} else if block2 != block {
		t.Errorf("Got back unexpected block: %v", block2)
	}

	// make sure its dirty status is right
	if !dirtyBcache.IsDirty(ptr, branch) {
		t.Errorf("Block %s unexpectedly not dirty", id)
	}
}

func testExpectedMissingDirty(t *testing.T, id BlockID,
	dirtyBcache DirtyBlockCache) {
	expectedErr := NoSuchBlockError{id}
	ptr := BlockPointer{ID: id}
	if _, err := dirtyBcache.Get(ptr, MasterBranch); err == nil {
		t.Errorf("No expected error on 1st get: %v", err)
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on 1st get: %v", err)
	}
}

func TestDirtyBcachePut(t *testing.T) {
	dirtyBcache := NewDirtyBlockCacheStandard()
	testDirtyBcachePut(t, fakeBlockID(1), dirtyBcache)
}

func TestDirtyBcachePutDuplicate(t *testing.T) {
	dirtyBcache := NewDirtyBlockCacheStandard()
	id1 := fakeBlockID(1)

	// Dirty a specific reference nonce, and make sure the
	// original is still not found.
	newNonce := BlockRefNonce([8]byte{1, 0, 0, 0, 0, 0, 0, 0})
	newNonceBlock := NewFileBlock()
	bp1 := BlockPointer{ID: id1}
	bp2 := BlockPointer{
		ID:           id1,
		BlockContext: BlockContext{RefNonce: newNonce},
	}
	err := dirtyBcache.Put(bp2, MasterBranch, newNonceBlock)
	if err != nil {
		t.Errorf("Unexpected error on PutDirty: %v", err)
	}

	cleanBranch := MasterBranch
	testExpectedMissingDirty(t, id1, dirtyBcache)
	if !dirtyBcache.IsDirty(bp2, cleanBranch) {
		t.Errorf("New refnonce block is now unexpectedly clean")
	}

	// Then dirty a different branch, and make sure the
	// original is still clean
	newBranch := BranchName("dirtyBranch")
	newBranchBlock := NewFileBlock()
	err = dirtyBcache.Put(bp1, newBranch, newBranchBlock)
	if err != nil {
		t.Errorf("Unexpected error on PutDirty: %v", err)
	}

	// make sure the original dirty status is right
	testExpectedMissingDirty(t, id1, dirtyBcache)
	if !dirtyBcache.IsDirty(bp2, cleanBranch) {
		t.Errorf("New refnonce block is now unexpectedly clean")
	}
	if !dirtyBcache.IsDirty(bp1, newBranch) {
		t.Errorf("New branch block is now unexpectedly clean")
	}
}

func TestDirtyBcacheDelete(t *testing.T) {
	dirtyBcache := NewDirtyBlockCacheStandard()

	id1 := fakeBlockID(1)
	testDirtyBcachePut(t, id1, dirtyBcache)
	newBranch := BranchName("dirtyBranch")
	newBranchBlock := NewFileBlock()
	err := dirtyBcache.Put(BlockPointer{ID: id1}, newBranch, newBranchBlock)
	if err != nil {
		t.Errorf("Unexpected error on PutDirty: %v", err)
	}

	dirtyBcache.Delete(BlockPointer{ID: id1}, MasterBranch)
	testExpectedMissingDirty(t, id1, dirtyBcache)
	if !dirtyBcache.IsDirty(BlockPointer{ID: id1}, newBranch) {
		t.Errorf("New branch block is now unexpectedly clean")
	}
}
