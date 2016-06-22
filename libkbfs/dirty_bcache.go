// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"time"

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
	start    time.Time
	deadline time.Time
}

// DirtyBlockCacheStandard implements the DirtyBlockCache interface by
// storing blocks in an in-memory cache.  Dirty blocks are identified
// by their block ID, branch name, and reference nonce, since the same
// block may be forked and modified on different branches and under
// different references simultaneously.
type DirtyBlockCacheStandard struct {
	clock Clock

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
	// When the number of un-synced dirty bytes is bigger than this
	// number, slow down writes intentionally based on the size of the
	// buffer, to attempt to avoid timeouts on low bandwidth
	// connections.
	backpressureBeginsAt int64

	lock               sync.RWMutex
	cache              map[dirtyBlockID]Block
	unsyncedDirtyBytes int64
	totalDirtyBytes    int64
}

// NewDirtyBlockCacheStandard constructs a new BlockCacheStandard
// instance.
func NewDirtyBlockCacheStandard(clock Clock, maxSyncBufferSize int64,
	maxDirtyBufferSize int64,
	backpressureBeginsAt int64) *DirtyBlockCacheStandard {
	d := &DirtyBlockCacheStandard{
		clock:                clock,
		requestsChan:         make(chan dirtyReq, 1000),
		bytesDecreasedChan:   make(chan struct{}, 1),
		shutdownChan:         make(chan struct{}),
		cache:                make(map[dirtyBlockID]Block),
		maxSyncBufferSize:    maxSyncBufferSize,
		maxDirtyBufferSize:   maxDirtyBufferSize,
		backpressureBeginsAt: backpressureBeginsAt,
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

const backpressureSlack = 1 * time.Second

func (d *DirtyBlockCacheStandard) calcBackpressureLocked(start time.Time,
	deadline time.Time) time.Duration {
	if d.unsyncedDirtyBytes <= d.backpressureBeginsAt {
		return 0
	}

	// We don't want to use the whole deadline, so cut it some slack.
	totalReqTime := deadline.Sub(start) - backpressureSlack
	if totalReqTime <= 0 {
		return 0
	}

	backpressureFrac := float64(d.unsyncedDirtyBytes-d.backpressureBeginsAt) /
		float64(d.maxSyncBufferSize-d.backpressureBeginsAt)
	totalBackpressure := time.Duration(
		float64(totalReqTime) * backpressureFrac)

	// How much time do we have left, given how much time this request
	// has waited so far?
	backpressureLeft := totalBackpressure - d.clock.Now().Sub(start)
	if backpressureLeft < 0 {
		return 0
	}
	return backpressureLeft
}

// calcBackpressure returns how much longer a given request should be
// kept in the queue, as a function of its deadline and how full the
// unsynced buffer is.  In its lifetime, the request should be blocked
// by roughly the same fraction of its total deadline as how full the
// unsynced buffer queue is.  This will let KBFS slow down Writes
// according to how slow the background Syncs are, so we don't
// accumulate more bytes to Sync than we can handle.  See KBFS-731.
func (d *DirtyBlockCacheStandard) calcBackpressure(start time.Time,
	deadline time.Time) time.Duration {
	d.lock.Lock()
	defer d.lock.Unlock()
	return d.calcBackpressureLocked(start, deadline)
}

func (d *DirtyBlockCacheStandard) acceptNewWrite(newBytes int64) bool {
	d.lock.Lock()
	defer d.lock.Unlock()
	// Accept any write, as long as we're not already over the limits.
	//
	// TODO: Only accept the write if the percentage of unsynced
	// buffer fullness is less than how close we are to the deadline
	// (figure out the exact formula).
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
	deadline, ok := ctx.Deadline()
	now := d.clock.Now()
	if !ok {
		deadline = now.Add(backgroundTaskTimeout)
	}
	req := dirtyReq{c, estimatedDirtyBytes, now, deadline}
	select {
	case d.requestsChan <- req:
		return c, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (d *DirtyBlockCacheStandard) signalDecreasedBytes() {
	select {
	case d.bytesDecreasedChan <- struct{}{}:
	default:
		// Already something queued there, and one is enough.
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
		d.signalDecreasedBytes()
	}
}

// BlockSyncFinished implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) BlockSyncFinished(size int64) {
	d.lock.Lock()
	defer d.lock.Unlock()
	d.unsyncedDirtyBytes -= size
	if size > 0 {
		d.signalDecreasedBytes()
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
	d.signalDecreasedBytes()
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
