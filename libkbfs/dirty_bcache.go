// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
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
//
// DirtyBlockCacheStandard controls how fast uses can write into KBFS,
// and does so with a TCP-like slow-start algorithm that adjusts
// itself according to how fast bytes are synced to the server.  It
// keeps track of a "sync buffer" that holds all of the bytes that
// have been written but not yet synced to the server.  When the
// buffer is full, write requests get blocked by a fraction of the
// write timeout, according to how close the user is to filling up
// their "dirty buffer" -- i.e., the total number of bytes for which
// an overall Sync operation has not yet completed (even if their
// individual block Puts to the server have completed).
//
// The size of the sync buffer can vary between a minimum and maximum.
// It starts out at the minimum, and grows exponentially as Puts
// succeed.  However, if a write request is blocked for too long by
// the backpressure and buffer-fullness checks, the sync buffer size
// is cut in half.
type DirtyBlockCacheStandard struct {
	clock   Clock
	makeLog func(string) logger.Logger
	log     logger.Logger
	reqWg   sync.WaitGroup

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

	// The minimum (and initial) size of the sync buffer.
	minSyncBufferSize int64
	// The maximum size of the sync buffer.  Also used as the
	// denominator when calculating backpressure, such that the closer
	// we are to reaching the maximum size (over and above the current
	// sync buffer), the more write requests will be delayed.
	maxSyncBufferSize int64

	shutdownLock sync.RWMutex
	isShutdown   bool

	lock               sync.RWMutex
	cache              map[dirtyBlockID]Block
	unsyncedDirtyBytes int64
	syncingDirtyBytes  int64 // just for bookkeeping, not actually used
	totalDirtyBytes    int64
	syncBufferSize     int64
}

// NewDirtyBlockCacheStandard constructs a new BlockCacheStandard
// instance.  makeLog is a function that will be called later to make
// a log (we don't take an actual log, to allow the DirtyBlockCache to
// be created before logging is initialized).  The min and max buffer
// sizes define the possible range of how many bytes we'll try to sync
// in any one sync.
func NewDirtyBlockCacheStandard(clock Clock,
	makeLog func(string) logger.Logger, minSyncBufferSize int64,
	maxSyncBufferSize int64) *DirtyBlockCacheStandard {
	d := &DirtyBlockCacheStandard{
		clock:              clock,
		makeLog:            makeLog,
		requestsChan:       make(chan dirtyReq, 1000),
		bytesDecreasedChan: make(chan struct{}, 1),
		shutdownChan:       make(chan struct{}),
		cache:              make(map[dirtyBlockID]Block),
		minSyncBufferSize:  minSyncBufferSize,
		maxSyncBufferSize:  maxSyncBufferSize,
		syncBufferSize:     minSyncBufferSize,
	}
	d.reqWg.Add(1)
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

// calcBackpressure returns how much longer a given request should be
// blocked, as a function of its deadline and how past full the
// syncing buffer is.  In its lifetime, the request should be blocked
// by roughly the same fraction of its total deadline as how past full
// the buffer is.  This will let KBFS slow down writes according to
// how slow the background Syncs are, so we don't accumulate more
// bytes to Sync than we can handle.  See KBFS-731.
func (d *DirtyBlockCacheStandard) calcBackpressure(start time.Time,
	deadline time.Time) time.Duration {
	d.lock.RLock()
	defer d.lock.RUnlock()
	// We don't want to use the whole deadline, so cut it some slack.
	totalReqTime := deadline.Sub(start) - backpressureSlack
	if totalReqTime <= 0 {
		return 0
	}

	// Keep the window full in preparation for the next sync, after
	// it's full start applying backpressure.
	if d.unsyncedDirtyBytes < d.syncBufferSize {
		return 0
	}

	// The backpressure is proportional to how far our overage is
	// towards the max sync buffer size.
	backpressureFrac := float64(d.unsyncedDirtyBytes-d.syncBufferSize) /
		float64(d.maxSyncBufferSize-d.syncBufferSize)
	if backpressureFrac > 1.0 {
		backpressureFrac = 1.0
	}
	totalBackpressure := time.Duration(
		float64(totalReqTime) * backpressureFrac)
	timeSpentSoFar := d.clock.Now().Sub(start)
	if totalBackpressure <= timeSpentSoFar {
		return 0
	}

	// How much time do we have left, given how much time this request
	// has waited so far?
	return totalBackpressure - timeSpentSoFar
}

func (d *DirtyBlockCacheStandard) logLocked(fmt string, arg ...interface{}) {
	if d.log == nil {
		log := d.makeLog("")
		if log != nil {
			d.log = log.CloneWithAddedDepth(1)
		}
	}
	if d.log != nil {
		// TODO: pass contexts all the way here just for logging? It's
		// extremely inconvenient to do that for the permission check
		// messages which happen in the background.
		d.log.CDebugf(nil, fmt, arg...)
	}
}

func (d *DirtyBlockCacheStandard) acceptNewWrite(newBytes int64,
	start time.Time, deadline time.Time) bool {
	d.lock.Lock()
	defer d.lock.Unlock()
	// Accept any write, as long as we're not already over the limits.
	canAccept := d.totalDirtyBytes < d.syncBufferSize
	if canAccept {
		d.unsyncedDirtyBytes += newBytes
		d.totalDirtyBytes += newBytes

		// Update syncBufferSize if the write has been blocked for more than
		// half of its deadline.
		allowedDeadline := float64(deadline.Sub(start))
		deadlineUsed := d.clock.Now().Sub(start)
		fracDeadlineUsed := float64(deadlineUsed) / allowedDeadline
		if fracDeadlineUsed > 0.5 {
			d.syncBufferSize /= 2
			if d.syncBufferSize < d.minSyncBufferSize {
				d.syncBufferSize = d.minSyncBufferSize
			}
			d.logLocked("Write blocked for %s (%f%% of deadline), "+
				"syncBufferSize=%d", deadlineUsed, fracDeadlineUsed*100,
				d.syncBufferSize)
		}
	}
	return canAccept
}

func (d *DirtyBlockCacheStandard) processPermission() {
	defer d.reqWg.Done()
	// Keep track of the most-recently seen request across loop
	// iterations, because we aren't necessarily going to be able to
	// deal with it as soon as we see it (since we might be past our
	// limits already).
	var currentReq dirtyReq
	var backpressure time.Duration
	for {
		reqChan := d.requestsChan
		if currentReq.respChan != nil {
			// We are already waiting on a request, so don't bother
			// trying to read another request from the requests chan.
			reqChan = nil
		}

		var bpTimer <-chan time.Time
		if backpressure > 0 {
			bpTimer = time.After(backpressure)
		}

		newReq := false
		select {
		case <-d.shutdownChan:
			return
		case <-d.bytesDecreasedChan:
		case <-bpTimer:
		case r := <-reqChan:
			currentReq = r
			newReq = true
		}

		if currentReq.respChan != nil {
			// Apply any backpressure?
			backpressure = d.calcBackpressure(currentReq.start,
				currentReq.deadline)
			if backpressure == 0 && d.acceptNewWrite(currentReq.bytes,
				currentReq.start, currentReq.deadline) {
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
			} else if backpressure != 0 {
				func() {
					d.lock.Lock()
					defer d.lock.Unlock()
					d.logLocked("Applying backpressure %s", backpressure)
				}()
			}
		}
	}
}

// RequestPermissionToDirty implements the DirtyBlockCache interface
// for DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) RequestPermissionToDirty(
	ctx context.Context, estimatedDirtyBytes int64) (DirtyPermChan, error) {
	d.shutdownLock.RLock()
	defer d.shutdownLock.RUnlock()
	if d.isShutdown {
		return nil, ShutdownHappenedError{}
	}

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
func (d *DirtyBlockCacheStandard) UpdateUnsyncedBytes(newUnsyncedBytes int64,
	wasSyncing bool) {
	d.lock.Lock()
	defer d.lock.Unlock()
	d.unsyncedDirtyBytes += newUnsyncedBytes
	d.totalDirtyBytes += newUnsyncedBytes
	if wasSyncing {
		d.syncingDirtyBytes += newUnsyncedBytes
	}
	if d.unsyncedDirtyBytes < 0 {
		d.signalDecreasedBytes()
	}
}

// UpdateSyncingBytes implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) UpdateSyncingBytes(size int64) {
	d.lock.Lock()
	defer d.lock.Unlock()
	d.syncingDirtyBytes += size
}

// BlockSyncFinished implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) BlockSyncFinished(size int64) {
	d.lock.Lock()
	defer d.lock.Unlock()
	d.unsyncedDirtyBytes -= size
	if size > 0 {
		d.syncingDirtyBytes -= size
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
	// Only increase the buffer size if we sent over a lot of bytes.
	// We don't want a series of small writes to increase the buffer
	// size, since that doesn't give us any real information about the
	// throughput of the connection.
	if size >= d.minSyncBufferSize {
		d.syncBufferSize += size
		if d.syncBufferSize > d.maxSyncBufferSize {
			d.syncBufferSize = d.maxSyncBufferSize
		}
	}
	d.signalDecreasedBytes()
	d.logLocked("Finished syncing %d bytes, syncBufferSize=%d, "+
		"totalDirty=%d", size, d.syncBufferSize, d.totalDirtyBytes)
}

// ShouldForceSync implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) ShouldForceSync() bool {
	d.lock.Lock()
	defer d.lock.Unlock()
	return d.unsyncedDirtyBytes > d.syncBufferSize
}

// Shutdown implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) Shutdown() error {
	func() {
		d.shutdownLock.Lock()
		defer d.shutdownLock.Unlock()
		d.isShutdown = true
		close(d.shutdownChan)
	}()

	d.reqWg.Wait()
	close(d.requestsChan)
	d.lock.Lock()
	defer d.lock.Unlock()
	// Clear out the remaining requests
	for req := range d.requestsChan {
		d.unsyncedDirtyBytes += req.bytes
		d.totalDirtyBytes += req.bytes
	}
	if d.unsyncedDirtyBytes != 0 || d.totalDirtyBytes != 0 ||
		d.syncingDirtyBytes != 0 {
		return fmt.Errorf("Unexpected dirty bytes leftover on shutdown: "+
			"unsynced=%d, syncing=%d, total=%d", d.unsyncedDirtyBytes,
			d.syncingDirtyBytes, d.totalDirtyBytes)
	}
	return nil
}
