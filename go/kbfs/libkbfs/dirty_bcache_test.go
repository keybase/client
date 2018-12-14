// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

func testDirtyBcachePut(t *testing.T, id kbfsblock.ID, dirtyBcache DirtyBlockCache) {
	block := NewFileBlock()
	ptr := BlockPointer{ID: id}
	branch := MasterBranch

	// put the block
	tlfID := tlf.FakeID(1, tlf.Private)
	if err := dirtyBcache.Put(tlfID, ptr, branch, block); err != nil {
		t.Errorf("Got error on Put for block %s: %v", id, err)
	}

	// make sure we can get it successfully
	if block2, err := dirtyBcache.Get(tlfID, ptr, branch); err != nil {
		t.Errorf("Got error on get for block %s: %v", id, err)
	} else if block2 != block {
		t.Errorf("Got back unexpected block: %v", block2)
	}

	// make sure its dirty status is right
	if !dirtyBcache.IsDirty(tlfID, ptr, branch) {
		t.Errorf("Block %s unexpectedly not dirty", id)
	}
}

func testExpectedMissingDirty(t *testing.T, id kbfsblock.ID,
	dirtyBcache DirtyBlockCache) {
	expectedErr := NoSuchBlockError{id}
	ptr := BlockPointer{ID: id}
	tlfID := tlf.FakeID(1, tlf.Private)
	if _, err := dirtyBcache.Get(tlfID, ptr, MasterBranch); err == nil {
		t.Errorf("No expected error on 1st get: %v", err)
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on 1st get: %v", err)
	}
}

func TestDirtyBcachePut(t *testing.T) {
	dirtyBcache := NewDirtyBlockCacheStandard(&wallClock{}, logger.NewTestLogger(t),
		5<<20, 10<<20, 5<<20)
	defer dirtyBcache.Shutdown()
	testDirtyBcachePut(t, kbfsblock.FakeID(1), dirtyBcache)
}

func TestDirtyBcachePutDuplicate(t *testing.T) {
	dirtyBcache := NewDirtyBlockCacheStandard(&wallClock{}, logger.NewTestLogger(t),
		5<<20, 10<<20, 5<<20)
	defer dirtyBcache.Shutdown()
	id1 := kbfsblock.FakeID(1)

	// Dirty a specific reference nonce, and make sure the
	// original is still not found.
	newNonce := kbfsblock.RefNonce([8]byte{1, 0, 0, 0, 0, 0, 0, 0})
	newNonceBlock := NewFileBlock()
	bp1 := BlockPointer{ID: id1}
	bp2 := BlockPointer{
		ID:      id1,
		Context: kbfsblock.Context{RefNonce: newNonce},
	}
	id := tlf.FakeID(1, tlf.Private)
	err := dirtyBcache.Put(id, bp2, MasterBranch, newNonceBlock)
	if err != nil {
		t.Errorf("Unexpected error on PutDirty: %v", err)
	}

	cleanBranch := MasterBranch
	testExpectedMissingDirty(t, id1, dirtyBcache)
	if !dirtyBcache.IsDirty(id, bp2, cleanBranch) {
		t.Errorf("New refnonce block is now unexpectedly clean")
	}

	// Then dirty a different branch, and make sure the
	// original is still clean
	newBranch := BranchName("dirtyBranch")
	newBranchBlock := NewFileBlock()
	err = dirtyBcache.Put(id, bp1, newBranch, newBranchBlock)
	if err != nil {
		t.Errorf("Unexpected error on PutDirty: %v", err)
	}

	// make sure the original dirty status is right
	testExpectedMissingDirty(t, id1, dirtyBcache)
	if !dirtyBcache.IsDirty(id, bp2, cleanBranch) {
		t.Errorf("New refnonce block is now unexpectedly clean")
	}
	if !dirtyBcache.IsDirty(id, bp1, newBranch) {
		t.Errorf("New branch block is now unexpectedly clean")
	}
}

func TestDirtyBcacheDelete(t *testing.T) {
	dirtyBcache := NewDirtyBlockCacheStandard(&wallClock{}, logger.NewTestLogger(t),
		5<<20, 10<<20, 5<<20)
	defer dirtyBcache.Shutdown()

	id1 := kbfsblock.FakeID(1)
	testDirtyBcachePut(t, id1, dirtyBcache)
	newBranch := BranchName("dirtyBranch")
	newBranchBlock := NewFileBlock()
	id := tlf.FakeID(1, tlf.Private)
	err := dirtyBcache.Put(id, BlockPointer{ID: id1}, newBranch, newBranchBlock)
	if err != nil {
		t.Errorf("Unexpected error on PutDirty: %v", err)
	}

	dirtyBcache.Delete(id, BlockPointer{ID: id1}, MasterBranch)
	testExpectedMissingDirty(t, id1, dirtyBcache)
	if !dirtyBcache.IsDirty(id, BlockPointer{ID: id1}, newBranch) {
		t.Errorf("New branch block is now unexpectedly clean")
	}
}

func TestDirtyBcacheRequestPermission(t *testing.T) {
	bufSize := int64(5)
	dirtyBcache := NewDirtyBlockCacheStandard(&wallClock{}, logger.NewTestLogger(t),
		bufSize, bufSize*2, bufSize)
	defer dirtyBcache.Shutdown()
	blockedChan := make(chan int64, 1)
	dirtyBcache.blockedChanForTesting = blockedChan
	ctx := context.Background()

	// The first write should get immediate permission.
	id := tlf.FakeID(1, tlf.Private)
	c1, err := dirtyBcache.RequestPermissionToDirty(ctx, id, bufSize*2+1)
	if err != nil {
		t.Fatalf("Request permission error: %v", err)
	}
	<-c1
	// Now the unsynced buffer is full
	if !dirtyBcache.ShouldForceSync(id) {
		t.Fatalf("Unsynced not full after a request")
	}
	// Not blocked
	if blockedSize := <-blockedChan; blockedSize != -1 {
		t.Fatalf("Wrong blocked size: %d", blockedSize)
	}

	// The next request should block
	c2, err := dirtyBcache.RequestPermissionToDirty(ctx, id, bufSize)
	if err != nil {
		t.Fatalf("Request permission error: %v", err)
	}
	if blockedSize := <-blockedChan; blockedSize != bufSize {
		t.Fatalf("Wrong blocked size: %d", blockedSize)
	}
	select {
	case <-c2:
		t.Fatalf("Request should be blocked")
	default:
	}

	// A 0-byte request should never fail.
	c3, err := dirtyBcache.RequestPermissionToDirty(ctx, id, 0)
	if err != nil {
		t.Fatalf("Request permission error: %v", err)
	}
	select {
	case <-c3:
	default:
		t.Fatalf("A 0-byte request was blocked")
	}

	// Let's say the actual number of unsynced bytes for c1 was double
	dirtyBcache.UpdateUnsyncedBytes(id, 4*bufSize+2, false)
	// Now release the previous bytes
	dirtyBcache.UpdateUnsyncedBytes(id, -(2*bufSize + 1), false)

	// Request 2 should still be blocked.  (This check isn't
	// fool-proof, since it doesn't necessarily give time for the
	// background thread to run.)
	if !dirtyBcache.ShouldForceSync(id) {
		t.Fatalf("Total not full before sync finishes")
	}
	select {
	case <-c2:
		t.Fatalf("Request should be blocked")
	default:
	}

	dirtyBcache.UpdateSyncingBytes(id, 4*bufSize+2)
	if blockedSize := <-blockedChan; blockedSize != -1 {
		t.Fatalf("Wrong blocked size: %d", blockedSize)
	}
	<-c2 // c2 is now unblocked since the wait buffer has drained.
	// We should still need to sync the waitBuf caused by c2.
	if !dirtyBcache.ShouldForceSync(id) {
		t.Fatalf("Buffers not full after c2 accepted")
	}

	// Finish syncing most of the blocks, but the c2 sync hasn't
	// finished.
	dirtyBcache.BlockSyncFinished(id, 2*bufSize+1)
	dirtyBcache.BlockSyncFinished(id, bufSize)
	dirtyBcache.BlockSyncFinished(id, bufSize+1)
	dirtyBcache.SyncFinished(id, 4*bufSize+2)
}

func TestDirtyBcacheCalcBackpressure(t *testing.T) {
	bufSize := int64(10)
	clock, now := newTestClockAndTimeNow()
	dirtyBcache := NewDirtyBlockCacheStandard(clock, logger.NewTestLogger(t),
		bufSize, bufSize*2, bufSize)
	defer dirtyBcache.Shutdown()
	// no backpressure yet
	bp := dirtyBcache.calcBackpressure(now, now.Add(11*time.Second))
	if bp != 0 {
		t.Fatalf("Unexpected backpressure before unsyned bytes: %d", bp)
	}

	// still less
	id := tlf.FakeID(1, tlf.Private)
	dirtyBcache.UpdateUnsyncedBytes(id, 9, false)
	bp = dirtyBcache.calcBackpressure(now, now.Add(11*time.Second))
	if bp != 0 {
		t.Fatalf("Unexpected backpressure before unsyned bytes: %d", bp)
	}

	// Now make 11 unsynced bytes, or 10% of the overage
	dirtyBcache.UpdateUnsyncedBytes(id, 2, false)
	bp = dirtyBcache.calcBackpressure(now, now.Add(11*time.Second))
	if g, e := bp, 1*time.Second; g != e {
		t.Fatalf("Got backpressure %s, expected %s", g, e)
	}

	// Now completely fill the buffer
	dirtyBcache.UpdateUnsyncedBytes(id, 9, false)
	bp = dirtyBcache.calcBackpressure(now, now.Add(11*time.Second))
	if g, e := bp, 10*time.Second; g != e {
		t.Fatalf("Got backpressure %s, expected %s", g, e)
	}

	// Now advance the clock, we should see the same bp deadline
	clock.Add(5 * time.Second)
	bp = dirtyBcache.calcBackpressure(now, now.Add(11*time.Second))
	if g, e := bp, 5*time.Second; g != e {
		t.Fatalf("Got backpressure %s, expected %s", g, e)
	}
}

func TestDirtyBcacheResetBufferCap(t *testing.T) {
	bufSize := int64(5)
	dirtyBcache := NewDirtyBlockCacheStandard(&wallClock{}, logger.NewTestLogger(t),
		bufSize, bufSize*2, bufSize)
	defer dirtyBcache.Shutdown()
	dirtyBcache.resetBufferCapTime = 1 * time.Millisecond
	blockedChan := make(chan int64, 1)
	dirtyBcache.blockedChanForTesting = blockedChan
	ctx := context.Background()

	// The first write should get immediate permission.
	id := tlf.FakeID(1, tlf.Private)
	c1, err := dirtyBcache.RequestPermissionToDirty(ctx, id, bufSize*2+1)
	if err != nil {
		t.Fatalf("Request permission error: %v", err)
	}
	<-c1
	// Now the unsynced buffer is full
	if !dirtyBcache.ShouldForceSync(id) {
		t.Fatalf("Unsynced not full after a request")
	}
	// Not blocked
	if blockedSize := <-blockedChan; blockedSize != -1 {
		t.Fatalf("Wrong blocked size: %d", blockedSize)
	}

	// Finish it
	dirtyBcache.UpdateSyncingBytes(id, 2*bufSize+1)
	dirtyBcache.BlockSyncFinished(id, 2*bufSize+1)
	dirtyBcache.SyncFinished(id, 2*bufSize+1)

	// Wait for the reset
	if blockedSize := <-blockedChan; blockedSize != -1 {
		t.Fatalf("Wrong blocked size: %d", blockedSize)
	}

	if curr := dirtyBcache.getSyncBufferCap(); curr != bufSize {
		t.Fatalf("Sync buffer cap was not reset, now %d", curr)
	}
}
