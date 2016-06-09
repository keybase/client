// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
)

type dirtyBlockID struct {
	id       BlockID
	refNonce BlockRefNonce
	branch   BranchName
}

// DirtyBlockCacheStandard implements the DirtyBlockCache interface by
// storing blocks in an in-memory cache.  Dirty blocks are identified
// by their block ID, branch name, and reference nonce, since the same
// block may be forked and modified on different branches and under
// different references simultaneously.
type DirtyBlockCacheStandard struct {
	// requestsChan is a queue for channels that should be closed when
	// permission is granted to dirty new data.
	requestsChan chan chan<- struct{}
	// bytesDecreasedChan is signalled when syncs have finished or dirty
	// blocks have been deleted.
	bytesDecreasedChan chan struct{}
	// shutdownChan is closed when Shutdown is called.
	shutdownChan chan struct{}

	// When the number of un-synced dirty bytes exceeds this level,
	// block new writes.
	maxSyncBufferSize int64
	// When the number of total dirty bytes exceeds this level, block
	// new writes.
	maxDirtyBufferSize int64

	lock               sync.Mutex
	cache              map[dirtyBlockID]Block
	unsyncedDirtyBytes int64
	totalDirtyBytes    int64
}

// NewDirtyBlockCacheStandard constructs a new BlockCacheStandard
// instance.
func NewDirtyBlockCacheStandard(maxSyncBufferSize int64,
	maxDirtyBufferSize int64) *DirtyBlockCacheStandard {
	d := &DirtyBlockCacheStandard{
		requestsChan:       make(chan chan<- struct{}, 1000),
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
		d.lock.Lock()
		defer d.lock.Unlock()
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

	d.lock.Lock()
	defer d.lock.Unlock()
	_, isDirty = d.cache[dirtyID]
	return
}

func (d *DirtyBlockCacheStandard) canAcceptNewWrite() bool {
	d.lock.Lock()
	defer d.lock.Unlock()
	return d.unsyncedDirtyBytes < d.maxSyncBufferSize &&
		d.totalDirtyBytes < d.maxDirtyBufferSize
}

func (d *DirtyBlockCacheStandard) processPermission() {
	var currentReq chan<- struct{}
	for {
		reqChan := d.requestsChan
		if currentReq != nil {
			// We are already waiting on a request
			reqChan = nil
		}

		select {
		case <-d.shutdownChan:
			return
		case <-d.bytesDecreasedChan:
		case c := <-reqChan:
			currentReq = c
		}

		if currentReq != nil && d.canAcceptNewWrite() {
			close(currentReq)
			currentReq = nil
		}
	}
}

// RequestPermissionToDirty implements the DirtyBlockCache interface
// for DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) RequestPermissionToDirty() DirtyPermChan {
	c := make(chan struct{})
	d.requestsChan <- c
	return c
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
	return !d.canAcceptNewWrite()
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
