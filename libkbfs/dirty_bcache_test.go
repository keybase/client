// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "testing"

func testDirtyBcachePut(t *testing.T, id BlockID, dbcache DirtyBlockCache) {
	block := NewFileBlock()
	ptr := BlockPointer{ID: id}
	branch := MasterBranch

	// put the block
	if err := dbcache.Put(ptr, branch, block); err != nil {
		t.Errorf("Got error on Put for block %s: %v", id, err)
	}

	// make sure we can get it successfully
	if block2, err := dbcache.Get(ptr, branch); err != nil {
		t.Errorf("Got error on get for block %s: %v", id, err)
	} else if block2 != block {
		t.Errorf("Got back unexpected block: %v", block2)
	}

	// make sure its dirty status is right
	if !dbcache.IsDirty(ptr, branch) {
		t.Errorf("Block %s unexpectedly not dirty", id)
	}
}

func testExpectedMissingDirty(t *testing.T, id BlockID,
	dbcache DirtyBlockCache) {
	expectedErr := NoSuchBlockError{id}
	ptr := BlockPointer{ID: id}
	if _, err := dbcache.Get(ptr, MasterBranch); err == nil {
		t.Errorf("No expected error on 1st get: %v", err)
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on 1st get: %v", err)
	}
}

func TestDirtyBcachePut(t *testing.T) {
	dbcache := NewDirtyBlockCacheStandard()
	testDirtyBcachePut(t, fakeBlockID(1), dbcache)
}

func TestDirtyBcachePutDuplicate(t *testing.T) {
	dbcache := NewDirtyBlockCacheStandard()
	id1 := fakeBlockID(1)

	// Dirty a specific reference nonce, and make sure the
	// original is still not found.
	newNonce := BlockRefNonce([8]byte{1, 0, 0, 0, 0, 0, 0, 0})
	newNonceBlock := NewFileBlock()
	err := dbcache.Put(BlockPointer{ID: id1, RefNonce: newNonce},
		MasterBranch, newNonceBlock)
	if err != nil {
		t.Errorf("Unexpected error on PutDirty: %v", err)
	}

	cleanBranch := MasterBranch
	testExpectedMissingDirty(t, id1, dbcache)
	if !dbcache.IsDirty(BlockPointer{ID: id1, RefNonce: newNonce},
		cleanBranch) {
		t.Errorf("New refnonce block is now unexpectedly clean")
	}

	// Then dirty a different branch, and make sure the
	// original is still clean
	newBranch := BranchName("dirtyBranch")
	newBranchBlock := NewFileBlock()
	err = dbcache.Put(BlockPointer{ID: id1}, newBranch, newBranchBlock)
	if err != nil {
		t.Errorf("Unexpected error on PutDirty: %v", err)
	}

	// make sure the original dirty status is right
	testExpectedMissingDirty(t, id1, dbcache)
	if !dbcache.IsDirty(BlockPointer{ID: id1, RefNonce: newNonce},
		cleanBranch) {
		t.Errorf("New refnonce block is now unexpectedly clean")
	}
	if !dbcache.IsDirty(BlockPointer{ID: id1}, newBranch) {
		t.Errorf("New branch block is now unexpectedly clean")
	}
}

func TestDirtyBcacheDelete(t *testing.T) {
	dbcache := NewDirtyBlockCacheStandard()

	id1 := fakeBlockID(1)
	testDirtyBcachePut(t, id1, dbcache)
	newBranch := BranchName("dirtyBranch")
	newBranchBlock := NewFileBlock()
	err := dbcache.Put(BlockPointer{ID: id1}, newBranch, newBranchBlock)
	if err != nil {
		t.Errorf("Unexpected error on PutDirty: %v", err)
	}

	dbcache.Delete(BlockPointer{ID: id1}, MasterBranch)
	testExpectedMissingDirty(t, id1, dbcache)
	if !dbcache.IsDirty(BlockPointer{ID: id1}, newBranch) {
		t.Errorf("New branch block is now unexpectedly clean")
	}
}
