// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"

	"golang.org/x/net/context"
)

type dirtyBlockID struct {
	id       BlockID
	refNonce BlockRefNonce
	branch   BranchName
}

type dirtyReq struct {
	respChan chan<- struct{}
	bytes    int64
}

// DirtyBlockCacheStandard implements the DirtyBlockCache interface by
// storing blocks in an in-memory cache.  Dirty blocks are identified
// by their block ID, branch name, and reference nonce, since the same
// block may be forked and modified on different branches and under
// different references simultaneously.
type DirtyBlockCacheStandard struct {
	// requestsChan is a queue for channels that should be closed when
	// permission is granted to dirty new data.
	requestsChan chan dirtyReq
	// bytesDecreasedChan is signalled when syncs have finished or dirty
	// blocks have been deleted.
	bytesDecreasedChan chan struct{}
	// shutdownChan is closed when Shutdown is called.
	shutdownChan chan struct{}
	// blockedChanForTesting sends out the number of bytes of the
	// request currently waiting.  Sends out -1 when the request is
	// accepted. Used only for testing.
	blockedChanForTesting chan<- int64

	// When the number of un-synced dirty bytes exceeds this level,
	// block new writes.
	maxSyncBufferSize int64
	// When the number of total dirty bytes exceeds this level, block
	// new writes.
	maxDirtyBufferSize int64

	lock               sync.RWMutex
	cache              map[dirtyBlockID]Block
	unsyncedDirtyBytes int64
	totalDirtyBytes    int64
}

// NewDirtyBlockCacheStandard constructs a new BlockCacheStandard
// instance.
func NewDirtyBlockCacheStandard(maxSyncBufferSize int64,
	maxDirtyBufferSize int64) *DirtyBlockCacheStandard {
	d := &DirtyBlockCacheStandard{
		requestsChan:       make(chan dirtyReq, 1000),
		bytesDecreasedChan: make(chan struct{}, 10),
		shutdownChan:       make(chan struct{}),
		cache:              make(map[dirtyBlockID]Block),
		maxSyncBufferSize:  maxSyncBufferSize,
		maxDirtyBufferSize: maxDirtyBufferSize,
	}
	go d.processPermission()
	return d
}

// Get implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) Get(ptr BlockPointer, branch BranchName) (
	Block, error) {
	block := func() Block {
		dirtyID := dirtyBlockID{
			id:       ptr.ID,
			refNonce: ptr.RefNonce,
			branch:   branch,
		}
		d.lock.RLock()
		defer d.lock.RUnlock()
		return d.cache[dirtyID]
	}()
	if block != nil {
		return block, nil
	}

	return nil, NoSuchBlockError{ptr.ID}
}

// Put implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) Put(ptr BlockPointer, branch BranchName,
	block Block) error {
	dirtyID := dirtyBlockID{
		id:       ptr.ID,
		refNonce: ptr.RefNonce,
		branch:   branch,
	}

	d.lock.Lock()
	defer d.lock.Unlock()
	d.cache[dirtyID] = block
	return nil
}

// Delete implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) Delete(ptr BlockPointer,
	branch BranchName) error {
	dirtyID := dirtyBlockID{
		id:       ptr.ID,
		refNonce: ptr.RefNonce,
		branch:   branch,
	}

	d.lock.Lock()
	defer d.lock.Unlock()
	delete(d.cache, dirtyID)
	return nil
}

// IsDirty implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) IsDirty(
	ptr BlockPointer, branch BranchName) (isDirty bool) {
	dirtyID := dirtyBlockID{
		id:       ptr.ID,
		refNonce: ptr.RefNonce,
		branch:   branch,
	}

	d.lock.RLock()
	defer d.lock.RUnlock()
	_, isDirty = d.cache[dirtyID]
	return
}

func (d *DirtyBlockCacheStandard) acceptNewWrite(newBytes int64) bool {
	d.lock.Lock()
	defer d.lock.Unlock()
	// Accept any write, as long as we're not already over the limits.
	canAccept := d.unsyncedDirtyBytes < d.maxSyncBufferSize &&
		d.totalDirtyBytes < d.maxDirtyBufferSize
	if canAccept {
		d.unsyncedDirtyBytes += newBytes
		d.totalDirtyBytes += newBytes
	}
	return canAccept
}

func (d *DirtyBlockCacheStandard) processPermission() {
	// Keep track of the most-recently seen request across loop
	// iterations, because we aren't necessarily going to be able to
	// deal with it as soon as we see it (since we might be past our
	// limits already).
	var currentReq dirtyReq
	for {
		reqChan := d.requestsChan
		if currentReq.respChan != nil {
			// We are already waiting on a request, so don't bother
			// trying to read another request from the requests chan.
			reqChan = nil
		}

		newReq := false
		select {
		case <-d.shutdownChan:
			return
		case <-d.bytesDecreasedChan:
		case r := <-reqChan:
			currentReq = r
			newReq = true
		}

		if currentReq.respChan != nil {
			if d.acceptNewWrite(currentReq.bytes) {
				// If we have an active request, and we have room in
				// our buffers to deal with it, grant permission to
				// the requestor by closing the response channel.
				close(currentReq.respChan)
				currentReq = dirtyReq{}
				if d.blockedChanForTesting != nil {
					d.blockedChanForTesting <- -1
				}
			} else if d.blockedChanForTesting != nil && newReq {
				// Otherwise, if this is the first time we've
				// considered this request, inform any tests that the
				// request is blocked.
				d.blockedChanForTesting <- currentReq.bytes
			}
		}
	}
}

// RequestPermissionToDirty implements the DirtyBlockCache interface
// for DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) RequestPermissionToDirty(
	ctx context.Context, estimatedDirtyBytes int64) (DirtyPermChan, error) {
	if estimatedDirtyBytes < 0 {
		panic("Must request permission for a non-negative number of bytes.")
	}
	c := make(chan struct{})
	select {
	case d.requestsChan <- dirtyReq{c, estimatedDirtyBytes}:
		return c, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// UpdateUnsyncedBytes implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) UpdateUnsyncedBytes(newUnsyncedBytes int64) {
	d.lock.Lock()
	defer d.lock.Unlock()
	d.unsyncedDirtyBytes += newUnsyncedBytes
	d.totalDirtyBytes += newUnsyncedBytes
	if d.unsyncedDirtyBytes < 0 {
		d.bytesDecreasedChan <- struct{}{}
	}
}

// BlockSyncFinished implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) BlockSyncFinished(size int64) {
	d.lock.Lock()
	defer d.lock.Unlock()
	d.unsyncedDirtyBytes -= size
	if size > 0 {
		d.bytesDecreasedChan <- struct{}{}
	}
}

// SyncFinished implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) SyncFinished(size int64) {
	d.lock.Lock()
	defer d.lock.Unlock()
	if size <= 0 {
		return
	}
	d.totalDirtyBytes -= size
	d.bytesDecreasedChan <- struct{}{}
}

// ShouldForceSync implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) ShouldForceSync() bool {
	return !d.acceptNewWrite(0)
}

// Shutdown implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) Shutdown() error {
	d.lock.Lock()
	defer d.lock.Unlock()
	close(d.shutdownChan)
	if d.unsyncedDirtyBytes != 0 || d.totalDirtyBytes != 0 {
		return fmt.Errorf("Unexpected dirty bytes leftover on shutdown: "+
			"unsynced=%d, total=%d", d.unsyncedDirtyBytes, d.totalDirtyBytes)
	}
	return nil
}
