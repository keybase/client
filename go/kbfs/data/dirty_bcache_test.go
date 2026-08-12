// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/stretchr/testify/require"
)

func testDirtyBcachePut(
	ctx context.Context, t *testing.T, id kbfsblock.ID,
	dirtyBcache DirtyBlockCache,
) {
	block := NewFileBlock()
	ptr := BlockPointer{ID: id}
	branch := MasterBranch

	// put the block
	tlfID := tlf.FakeID(1, tlf.Private)
	err := dirtyBcache.Put(ctx, tlfID, ptr, branch, block)
	require.NoError(t, err, "Got error on Put for block %s: %v", id, err)

	// make sure we can get it successfully
	block2, err := dirtyBcache.Get(ctx, tlfID, ptr, branch)
	require.NoError(t, err, "Got error on get for block %s: %v", id, err)
	require.Equal(t, block, block2, "Got back unexpected block: %v", block2)

	// make sure its dirty status is right
	require.True(t, dirtyBcache.IsDirty(tlfID, ptr, branch), "Block %s unexpectedly not dirty", id)
}

func testExpectedMissingDirty(
	ctx context.Context, t *testing.T, id kbfsblock.ID,
	dirtyBcache DirtyBlockCache,
) {
	expectedErr := NoSuchBlockError{id}
	ptr := BlockPointer{ID: id}
	tlfID := tlf.FakeID(1, tlf.Private)
	_, err := dirtyBcache.Get(ctx, tlfID, ptr, MasterBranch)
	require.NotNil(t, err, "No expected error on 1st get: %v", err)
	require.Equal(t, expectedErr, err, "Got unexpected error on 1st get: %v", err)
}

func testDirtyBcacheShutdown(
	t *testing.T, dirtyBcache *DirtyBlockCacheStandard,
) {
	err := dirtyBcache.Shutdown()
	require.NoError(t, err)
}

func TestDirtyBcachePut(t *testing.T) {
	log := logger.NewTestLogger(t)
	dirtyBcache := NewDirtyBlockCacheStandard(
		&WallClock{}, log, libkb.NewVDebugLog(log), 5<<20, 10<<20, 5<<20)
	defer testDirtyBcacheShutdown(t, dirtyBcache)
	testDirtyBcachePut(
		context.Background(), t, kbfsblock.FakeID(1), dirtyBcache)
}

func TestDirtyBcachePutDuplicate(t *testing.T) {
	log := logger.NewTestLogger(t)
	dirtyBcache := NewDirtyBlockCacheStandard(
		&WallClock{}, log, libkb.NewVDebugLog(log), 5<<20, 10<<20, 5<<20)
	defer testDirtyBcacheShutdown(t, dirtyBcache)
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
	ctx := context.Background()
	err := dirtyBcache.Put(ctx, id, bp2, MasterBranch, newNonceBlock)
	require.NoError(t, err, "Unexpected error on PutDirty: %v", err)

	cleanBranch := MasterBranch
	testExpectedMissingDirty(ctx, t, id1, dirtyBcache)
	require.True(t, dirtyBcache.IsDirty(id, bp2, cleanBranch), "New refnonce block is now unexpectedly clean")

	// Then dirty a different branch, and make sure the
	// original is still clean
	newBranch := BranchName("dirtyBranch")
	newBranchBlock := NewFileBlock()
	err = dirtyBcache.Put(ctx, id, bp1, newBranch, newBranchBlock)
	require.NoError(t, err, "Unexpected error on PutDirty: %v", err)

	// make sure the original dirty status is right
	testExpectedMissingDirty(ctx, t, id1, dirtyBcache)
	require.True(t, dirtyBcache.IsDirty(id, bp2, cleanBranch), "New refnonce block is now unexpectedly clean")
	require.True(t, dirtyBcache.IsDirty(id, bp1, newBranch), "New branch block is now unexpectedly clean")
}

func TestDirtyBcacheDelete(t *testing.T) {
	log := logger.NewTestLogger(t)
	dirtyBcache := NewDirtyBlockCacheStandard(
		&WallClock{}, log, libkb.NewVDebugLog(log), 5<<20, 10<<20, 5<<20)
	defer testDirtyBcacheShutdown(t, dirtyBcache)

	id1 := kbfsblock.FakeID(1)
	ctx := context.Background()
	testDirtyBcachePut(ctx, t, id1, dirtyBcache)
	newBranch := BranchName("dirtyBranch")
	newBranchBlock := NewFileBlock()
	id := tlf.FakeID(1, tlf.Private)
	err := dirtyBcache.Put(
		ctx, id, BlockPointer{ID: id1}, newBranch, newBranchBlock)
	require.NoError(t, err, "Unexpected error on PutDirty: %v", err)

	err = dirtyBcache.Delete(id, BlockPointer{ID: id1}, MasterBranch)
	require.NoError(t, err)
	testExpectedMissingDirty(ctx, t, id1, dirtyBcache)
	require.True(t, dirtyBcache.IsDirty(id, BlockPointer{ID: id1}, newBranch), "New branch block is now unexpectedly clean")
}

func TestDirtyBcacheRequestPermission(t *testing.T) {
	bufSize := int64(5)
	log := logger.NewTestLogger(t)
	dirtyBcache := NewDirtyBlockCacheStandard(
		&WallClock{}, log, libkb.NewVDebugLog(log), bufSize, bufSize*2, bufSize)
	defer testDirtyBcacheShutdown(t, dirtyBcache)
	blockedChan := make(chan int64, 1)
	dirtyBcache.blockedChanForTesting = blockedChan
	ctx := context.Background()

	// The first write should get immediate permission.
	id := tlf.FakeID(1, tlf.Private)
	c1, err := dirtyBcache.RequestPermissionToDirty(ctx, id, bufSize*2+1)
	require.NoError(t, err,
		"Request permission error: %v", err)
	<-c1
	// Now the unsynced buffer is full
	require.True(t, dirtyBcache.ShouldForceSync(id),
		"Unsynced not full after a request")
	// Not blocked
	if blockedSize := <-blockedChan; blockedSize != -1 {
		require.FailNow(t, fmt.Sprintf("Wrong blocked size: %d", blockedSize))
	}

	// The next request should block
	c2, err := dirtyBcache.RequestPermissionToDirty(ctx, id, bufSize)
	require.NoError(t, err,
		"Request permission error: %v", err)
	if blockedSize := <-blockedChan; blockedSize != bufSize {
		require.FailNow(t, fmt.Sprintf("Wrong blocked size: %d", blockedSize))
	}
	select {
	case <-c2:
		require.FailNow(t, "Request should be blocked")
	default:
	}

	// A 0-byte request should never fail.
	c3, err := dirtyBcache.RequestPermissionToDirty(ctx, id, 0)
	require.NoError(t, err,
		"Request permission error: %v", err)
	select {
	case <-c3:
	default:
		require.FailNow(t, "A 0-byte request was blocked")
	}

	// Let's say the actual number of unsynced bytes for c1 was double
	dirtyBcache.UpdateUnsyncedBytes(id, 4*bufSize+2, false)
	// Now release the previous bytes
	dirtyBcache.UpdateUnsyncedBytes(id, -(2*bufSize + 1), false)

	// Request 2 should still be blocked.  (This check isn't
	// fool-proof, since it doesn't necessarily give time for the
	// background thread to run.)
	require.True(t, dirtyBcache.ShouldForceSync(id),
		"Total not full before sync finishes")
	select {
	case <-c2:
		require.FailNow(t, "Request should be blocked")
	default:
	}

	dirtyBcache.UpdateSyncingBytes(id, 4*bufSize+2)
	if blockedSize := <-blockedChan; blockedSize != -1 {
		require.FailNow(t, fmt.Sprintf("Wrong blocked size: %d", blockedSize))
	}
	<-c2 // c2 is now unblocked since the wait buffer has drained.
	// We should still need to sync the waitBuf caused by c2.
	require.True(t, dirtyBcache.ShouldForceSync(id),
		"Buffers not full after c2 accepted")

	// Finish syncing most of the blocks, but the c2 sync hasn't
	// finished.
	dirtyBcache.BlockSyncFinished(id, 2*bufSize+1)
	dirtyBcache.BlockSyncFinished(id, bufSize)
	dirtyBcache.BlockSyncFinished(id, bufSize+1)
	dirtyBcache.SyncFinished(id, 4*bufSize+2)
	// c2.
	dirtyBcache.UpdateSyncingBytes(id, bufSize)
	dirtyBcache.BlockSyncFinished(id, bufSize)
	dirtyBcache.SyncFinished(id, bufSize)
}

func TestDirtyBcacheCalcBackpressure(t *testing.T) {
	bufSize := int64(10)
	clock, now := clocktest.NewTestClockAndTimeNow()
	log := logger.NewTestLogger(t)
	dirtyBcache := NewDirtyBlockCacheStandard(
		clock, log, libkb.NewVDebugLog(log), bufSize, bufSize*2, bufSize)
	defer testDirtyBcacheShutdown(t, dirtyBcache)
	// no backpressure yet
	bp := dirtyBcache.calcBackpressure(now, now.Add(11*time.Second))
	require.Zero(t, bp,
		"Unexpected backpressure before unsyned bytes: %d", bp)

	// still less
	id := tlf.FakeID(1, tlf.Private)
	dirtyBcache.UpdateUnsyncedBytes(id, 9, false)
	bp = dirtyBcache.calcBackpressure(now, now.Add(11*time.Second))
	require.Zero(t, bp,
		"Unexpected backpressure before unsyned bytes: %d", bp)

	// Now make 11 unsynced bytes, or 10% of the overage
	dirtyBcache.UpdateUnsyncedBytes(id, 2, false)
	bp = dirtyBcache.calcBackpressure(now, now.Add(11*time.Second))
	if g, e := bp, 1*time.Second; g != e {
		require.FailNow(t, fmt.Sprintf("Got backpressure %s, expected %s", g, e))
	}

	// Now completely fill the buffer
	dirtyBcache.UpdateUnsyncedBytes(id, 9, false)
	bp = dirtyBcache.calcBackpressure(now, now.Add(11*time.Second))
	if g, e := bp, 10*time.Second; g != e {
		require.FailNow(t, fmt.Sprintf("Got backpressure %s, expected %s", g, e))
	}

	// Now advance the clock, we should see the same bp deadline
	clock.Add(5 * time.Second)
	bp = dirtyBcache.calcBackpressure(now, now.Add(11*time.Second))
	if g, e := bp, 5*time.Second; g != e {
		require.FailNow(t, fmt.Sprintf("Got backpressure %s, expected %s", g, e))
	}

	dirtyBcache.UpdateSyncingBytes(id, 20)
	dirtyBcache.BlockSyncFinished(id, 20)
	dirtyBcache.SyncFinished(id, 20)
}

func TestDirtyBcacheResetBufferCap(t *testing.T) {
	bufSize := int64(5)
	log := logger.NewTestLogger(t)
	dirtyBcache := NewDirtyBlockCacheStandard(
		&WallClock{}, log, libkb.NewVDebugLog(log), bufSize, bufSize*2, bufSize)
	defer testDirtyBcacheShutdown(t, dirtyBcache)
	dirtyBcache.resetBufferCapTime = 1 * time.Millisecond
	blockedChan := make(chan int64, 1)
	dirtyBcache.blockedChanForTesting = blockedChan
	ctx := context.Background()

	// The first write should get immediate permission.
	id := tlf.FakeID(1, tlf.Private)
	c1, err := dirtyBcache.RequestPermissionToDirty(ctx, id, bufSize*2+1)
	require.NoError(t, err,
		"Request permission error: %v", err)
	<-c1
	// Now the unsynced buffer is full
	require.True(t, dirtyBcache.ShouldForceSync(id),
		"Unsynced not full after a request")
	// Not blocked
	if blockedSize := <-blockedChan; blockedSize != -1 {
		require.FailNow(t, fmt.Sprintf("Wrong blocked size: %d", blockedSize))
	}

	// Finish it
	dirtyBcache.UpdateSyncingBytes(id, 2*bufSize+1)
	dirtyBcache.BlockSyncFinished(id, 2*bufSize+1)
	dirtyBcache.SyncFinished(id, 2*bufSize+1)

	// Wait for the reset
	if blockedSize := <-blockedChan; blockedSize != -1 {
		require.FailNow(t, fmt.Sprintf("Wrong blocked size: %d", blockedSize))
	}

	if curr := dirtyBcache.getSyncBufferCap(); curr != bufSize {
		require.FailNow(t, fmt.Sprintf("Sync buffer cap was not reset, now %d", curr))
	}
}
