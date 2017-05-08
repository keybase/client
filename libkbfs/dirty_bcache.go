// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type dirtyBlockID struct {
	id       kbfsblock.ID
	refNonce kbfsblock.RefNonce
	branch   BranchName
}

type dirtyReq struct {
	respChan chan<- struct{}
	bytes    int64
	start    time.Time
	deadline time.Time
}

const (
	resetBufferCapTimeDefault = 5 * time.Minute
)

// DirtyBlockCacheStandard implements the DirtyBlockCache interface by
// storing blocks in an in-memory cache.  Dirty blocks are identified
// by their block ID, branch name, and reference nonce, since the same
// block may be forked and modified on different branches and under
// different references simultaneously.
//
// DirtyBlockCacheStandard controls how fast uses can write into KBFS,
// and does so with a TCP-like slow-start algorithm that adjusts
// itself according to how fast bytes are synced to the server.
// Conceptually, there are two buffers:
//
//   syncBuf: The bytes that are currently syncing, or have finished
//   syncing, back to the servers.  Each TLF has only one sync at a
//   time, but multiple TLFs may be syncing at the same time.  We also
//   track how many bytes within this buffer have finished syncing.
//
//   waitBuf: The bytes that have not yet begun syncing to the
//   servers.  Again, this can be for multiple TLFs, and from multiple
//   files within a TLF.  In the TCP analogy, think of this as the
//   congestion window (cwnd).
//
// The goal is to make sure that syncBuf can always be transmitted to
// the server within the file system operation timeout forced on us by
// the layer that interacts with the file system (19 seconds on OS X
// and Windows, defaults to 30 seconds for other layers if not already
// set).  In fact, ideally the data would be transmitted in HALF of
// the file system operation timeout, in case a user Sync operation
// gets blocked behind a background Sync operation when there is
// significant data in waitBuf.  At the same time, we want it to be as
// big as possible, because we get the best performance when writing
// lots of blocks in parallel to the servers.  So, we want an
// algorithm that allows waitBuf to grow, without causing the next
// sync (or write, or setattr, etc) operation to timeout.  For the
// purposes of this discussion, let's assume there is only one active
// TLF at a time.
//
// We allow the user to set a min, start, and max size for waitBuf.
// Whenever a sync starts, bytes are transferred from waitBuf into
// syncBuf and a timer is started.  When a sync completes
// successfully, the number of bytes synced is added to the allowed
// size of waitBuf (i.e., "additive increase" == exponential growth).
// However, if the number of sync'd bytes is smaller than the min
// waitBuf size, we don't do additive increase (because we haven't
// really tested the throughput of the server connection in that case).
//
// If the sync takes more than 33% of half the overall operation
// timeout, the size of waitBuf is reduced by that same percentage
// (i.e., "multiplicative decrease"), and any outstanding bytes in the
// sync will not be used in the "additive increase" phase when the
// sync completes (they are considered "lost" in the TCP analogy, even
// though they should eventually succeed).  The 33% limit was chosen
// mostly by trial and error, although if you assume that
// capacity(waitBuf) will double after each sync, then `2*len(syncBuf)
// == capacity(waitBuf)`, so at any given point there can be about
// 3*capacity(syncBuf) bytes buffered; so if syncBuf can't be sync'd
// in a third of the overall timeout, the next waitBuf should be
// reduced.
//
// Finally, we need to make sure that the Write calls that are filling
// up waitBuf while a sync is happening don't timeout.  But, we also
// need to fill waitBuf quickly, so that the next sync is ready to go
// as soon as the first one completes.  Here we implement a
// compromise.  Allow waitBuf to fill up instantly until it holds
// capacity(syncBuf) bytes.  After that, allow it to fill up to
// 2*capacity(syncBuf), but artificially delay each write by adding
// backpressure, by some fraction of the system operation timeout that
// matches the fraction of the progress the buffer has made between
// capacity(syncBuf) and 2*capacity(syncBuf).  As soon as the sync
// completes, any delayed write is unblocked and gets to start filling
// up the buffers again.
//
// To avoid keeping the buffer capacity large when network conditions
// suddenly worsen (say after a laptop sleep when it comes back online
// on a new, worse network), the capacity is reset back to the minimum
// if resetBufferCapTime passes without any large syncs.  TODO: in the
// future it might make sense to decrease the buffer capacity, rather
// than resetting it to the minimum?
type DirtyBlockCacheStandard struct {
	clock Clock
	log   logger.Logger
	reqWg sync.WaitGroup

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

	// The minimum (and initial) capacity of the sync buffer.
	minSyncBufCap int64
	// The maximum capacity of the sync buffer.  Also used as the
	// denominator when calculating backpressure, such that the closer
	// we are to reaching the maximum size (over and above the current
	// sync buffer), the more write requests will be delayed.
	maxSyncBufCap int64

	// After how long without a syncBufferCap-sized sync will
	// syncBufferCap be reset automatically back down to the minimum,
	// to avoid keeping it too high as network conditions change?
	resetBufferCapTime time.Duration

	shutdownLock sync.RWMutex
	isShutdown   bool

	lock            sync.RWMutex
	cache           map[dirtyBlockID]Block
	syncBufBytes    int64
	waitBufBytes    int64
	syncBufferCap   int64
	ignoreSyncBytes int64 // these bytes have "timed out"
	syncStarted     time.Time
	resetter        *time.Timer
}

// NewDirtyBlockCacheStandard constructs a new BlockCacheStandard
// instance.  The min and max buffer capacities define the possible
// range of how many bytes we'll try to sync in any one sync, and the
// start size defines the initial buffer size.
func NewDirtyBlockCacheStandard(clock Clock,
	log logger.Logger, minSyncBufCap int64,
	maxSyncBufCap int64, startSyncBufCap int64) *DirtyBlockCacheStandard {
	d := &DirtyBlockCacheStandard{
		clock:              clock,
		log:                log,
		requestsChan:       make(chan dirtyReq, 1000),
		bytesDecreasedChan: make(chan struct{}, 1),
		shutdownChan:       make(chan struct{}),
		cache:              make(map[dirtyBlockID]Block),
		minSyncBufCap:      minSyncBufCap,
		maxSyncBufCap:      maxSyncBufCap,
		syncBufferCap:      startSyncBufCap,
		resetBufferCapTime: resetBufferCapTimeDefault,
	}
	d.reqWg.Add(1)
	go d.processPermission()
	return d
}

// simpleDirtyBlockCacheStandard that can only handle block
// put/get/delete requests; it cannot track dirty bytes.
func simpleDirtyBlockCacheStandard() *DirtyBlockCacheStandard {
	return &DirtyBlockCacheStandard{
		cache: make(map[dirtyBlockID]Block),
	}
}

// Get implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) Get(_ tlf.ID, ptr BlockPointer,
	branch BranchName) (Block, error) {
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
func (d *DirtyBlockCacheStandard) Put(_ tlf.ID, ptr BlockPointer,
	branch BranchName, block Block) error {
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
func (d *DirtyBlockCacheStandard) Delete(_ tlf.ID, ptr BlockPointer,
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
func (d *DirtyBlockCacheStandard) IsDirty(_ tlf.ID, ptr BlockPointer,
	branch BranchName) (isDirty bool) {
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

// IsAnyDirty implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) IsAnyDirty(_ tlf.ID) bool {
	d.lock.RLock()
	defer d.lock.RUnlock()
	return len(d.cache) > 0 || d.syncBufBytes > 0 || d.waitBufBytes > 0
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
	if d.waitBufBytes < d.syncBufferCap {
		return 0
	}

	// The backpressure is proportional to how far our overage is
	// toward filling up our next sync buffer.
	backpressureFrac := float64(d.waitBufBytes-d.syncBufferCap) /
		float64(d.syncBufferCap)
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

func (d *DirtyBlockCacheStandard) acceptNewWrite(newBytes int64) bool {
	d.lock.Lock()
	defer d.lock.Unlock()
	// Accept any write, as long as we're not already over the limits.
	// Allow the total dirty bytes to get close to double the max
	// buffer size, to allow us to fill up the buffer for the next
	// sync.
	canAccept := d.waitBufBytes < d.maxSyncBufCap*2
	if canAccept {
		d.waitBufBytes += newBytes
	}

	return canAccept
}

func (d *DirtyBlockCacheStandard) maybeDecreaseBuffer(start time.Time,
	deadline time.Time, soFar float64) (bool, time.Duration, float64) {
	// Update syncBufferCap if the write has been blocked for more
	// than half of its timeout.  (We use half the timeout in case a
	// user Sync operation, which can't be subjected to backpressure,
	// is blocked by a background Sync operation when waitBuf is
	// nearly full.)
	allowedTimeout := float64(deadline.Sub(start)) / 2.0
	timeoutUsed := d.clock.Now().Sub(start)
	fracTimeoutUsed := float64(timeoutUsed) / allowedTimeout
	if fracTimeoutUsed >= 0.33 {
		d.lock.Lock()
		defer d.lock.Unlock()
		// Decrease the syncBufferCap by the percentage of the timeout
		// we're using, minus the percentage we've already decreased
		// it so far.  TODO: a more logical algorithm would probably
		// keep track of what the syncBufferCap was before the Sync
		// started, and multiply that by the entire fracTimeoutUsed,
		// since subtracting percentages in this way doesn't make a
		// whole lot of sense.
		d.syncBufferCap = int64(float64(d.syncBufferCap) *
			(1 - (fracTimeoutUsed - soFar)))
		if d.syncBufferCap < d.minSyncBufCap {
			d.syncBufferCap = d.minSyncBufCap
		}
		d.log.CDebugf(context.TODO(), "Writes blocked for %s (%f%% of timeout), "+
			"syncBufferCap=%d", timeoutUsed, fracTimeoutUsed*100,
			d.syncBufferCap)
		if d.syncBufBytes > d.ignoreSyncBytes {
			d.ignoreSyncBytes = d.syncBufBytes
		}
		return true, time.Duration(allowedTimeout), fracTimeoutUsed
	}

	// If we haven't decreased the buffer yet, make sure we get a
	// wake-up call at the right time.
	maxWakeup := allowedTimeout / 3.0
	return false, time.Duration(maxWakeup) - timeoutUsed, soFar
}

func (d *DirtyBlockCacheStandard) getSyncStarted() time.Time {
	d.lock.RLock()
	defer d.lock.RUnlock()
	return d.syncStarted
}

func (d *DirtyBlockCacheStandard) getSyncBufferCap() int64 {
	d.lock.RLock()
	defer d.lock.RUnlock()
	return d.syncBufferCap
}

func (d *DirtyBlockCacheStandard) processPermission() {
	defer d.reqWg.Done()
	// Keep track of the most-recently seen request across loop
	// iterations, because we aren't necessarily going to be able to
	// deal with it as soon as we see it (since we might be past our
	// limits already).
	var currentReq dirtyReq
	var backpressure time.Duration
	var maxWakeup time.Duration
	decreased := false
	var fracDeadlineSoFar float64
	var lastKnownTimeout time.Duration
	for {
		reqChan := d.requestsChan
		if currentReq.respChan != nil {
			// We are already waiting on a request, so don't bother
			// trying to read another request from the requests chan.
			reqChan = nil

			// If we haven't decreased the buffer size yet, make sure
			// we wake up in time to do that.
			if !decreased && (backpressure <= 0 || maxWakeup < backpressure) {
				backpressure = maxWakeup
			}
		} else if !d.getSyncStarted().IsZero() {
			// There are no requests pending, but there is still a
			// sync pending.
			backpressure = maxWakeup
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
			decreased = false
		}

		if currentReq.respChan != nil || maxWakeup > 0 {
			syncStarted := d.getSyncStarted()
			// Has this sync been blocking so long that we should
			// decrease the buffer size?
			if !syncStarted.IsZero() {
				deadline := syncStarted.Add(lastKnownTimeout)
				decreased, maxWakeup, fracDeadlineSoFar =
					d.maybeDecreaseBuffer(syncStarted,
						deadline, fracDeadlineSoFar)
			} else {
				maxWakeup = 0
			}
		}

		if currentReq.respChan != nil {
			lastKnownTimeout = currentReq.deadline.Sub(currentReq.start)
			// Apply any backpressure?
			backpressure = d.calcBackpressure(currentReq.start,
				currentReq.deadline)
			if backpressure == 0 && d.acceptNewWrite(currentReq.bytes) {
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
					if d.syncStarted.IsZero() {
						// TODO: in this case where there are multiple
						// concurrent Syncs from multiple TLFs, this
						// might not correctly capture the start time
						// of the Nth Sync.  We might want to assign
						// each Sync its own unique ID somehow, so we
						// can track them separately and more
						// accurately.
						d.syncStarted = d.clock.Now()
						fracDeadlineSoFar = 0
					}
					d.log.CDebugf(context.TODO(), "Applying backpressure %s", backpressure)
				}()
			}
		}
	}
}

// RequestPermissionToDirty implements the DirtyBlockCache interface
// for DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) RequestPermissionToDirty(
	ctx context.Context, _ tlf.ID, estimatedDirtyBytes int64) (
	DirtyPermChan, error) {
	d.shutdownLock.RLock()
	defer d.shutdownLock.RUnlock()
	if d.isShutdown {
		return nil, ShutdownHappenedError{}
	}

	if estimatedDirtyBytes < 0 {
		panic("Must request permission for a non-negative number of bytes.")
	}
	c := make(chan struct{})
	now := d.clock.Now()
	deadline, ok := ctx.Deadline()
	defaultDeadline := now.Add(backgroundTaskTimeout / 2)
	if !ok || deadline.After(defaultDeadline) {
		// Use half of the background task timeout, to make sure we
		// never get close to a timeout in a background task.
		deadline = defaultDeadline
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

func (d *DirtyBlockCacheStandard) updateWaitBufLocked(bytes int64) {
	d.waitBufBytes += bytes
	if d.waitBufBytes < 0 {
		// It would be better if we didn't have this check, but it's
		// hard for folderBlockOps to account correctly when bytes in
		// a syncing block are overwritten, and then the write is
		// deferred (see KBFS-2157).
		d.waitBufBytes = 0
	}
}

// UpdateUnsyncedBytes implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) UpdateUnsyncedBytes(_ tlf.ID,
	newUnsyncedBytes int64, wasSyncing bool) {
	d.lock.Lock()
	defer d.lock.Unlock()
	if wasSyncing {
		d.syncBufBytes += newUnsyncedBytes
	} else {
		d.updateWaitBufLocked(newUnsyncedBytes)
	}
	if newUnsyncedBytes < 0 {
		d.signalDecreasedBytes()
	}
}

// UpdateSyncingBytes implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) UpdateSyncingBytes(_ tlf.ID, size int64) {
	d.lock.Lock()
	defer d.lock.Unlock()
	d.syncBufBytes += size
	d.updateWaitBufLocked(-size)
	d.signalDecreasedBytes()
}

// BlockSyncFinished implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) BlockSyncFinished(_ tlf.ID, size int64) {
	d.lock.Lock()
	defer d.lock.Unlock()
	if size > 0 {
		d.syncBufBytes -= size
	} else {
		// The block will be retried, so put it back on the waitBuf
		d.updateWaitBufLocked(-size)
	}
	if size > 0 {
		d.signalDecreasedBytes()
	}
}

func (d *DirtyBlockCacheStandard) resetBufferCap() {
	d.lock.Lock()
	defer d.lock.Unlock()
	d.log.CDebugf(context.TODO(), "Resetting syncBufferCap from %d to %d", d.syncBufferCap,
		d.minSyncBufCap)
	d.syncBufferCap = d.minSyncBufCap
	d.resetter = nil
	if d.blockedChanForTesting != nil {
		d.blockedChanForTesting <- -1
	}
}

// SyncFinished implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) SyncFinished(_ tlf.ID, size int64) {
	d.lock.Lock()
	defer d.lock.Unlock()
	if size <= 0 {
		return
	}
	d.syncStarted = time.Time{}

	// If the outstanding bytes have timed out, don't count them
	// towards the buffer increase.
	ignore := d.ignoreSyncBytes
	if ignore > size {
		ignore = size
	}
	bufferIncrease := size - ignore
	d.ignoreSyncBytes -= ignore

	// If the sync was a reasonably large fraction of the current
	// buffer capacity, restart the reset timer.
	if size >= d.syncBufferCap/2 {
		if d.resetter != nil {
			d.resetter.Stop()
		}
		d.resetter = time.AfterFunc(d.resetBufferCapTime, d.resetBufferCap)
	}

	// Only increase the buffer size if we sent over a lot of bytes.
	// We don't want a series of small writes to increase the buffer
	// size, since that doesn't give us any real information about the
	// throughput of the connection.
	if bufferIncrease >= d.syncBufferCap {
		d.syncBufferCap += bufferIncrease
		if d.syncBufferCap > d.maxSyncBufCap {
			d.syncBufferCap = d.maxSyncBufCap
		}
	}
	d.signalDecreasedBytes()
	d.log.CDebugf(context.TODO(), "Finished syncing %d bytes, syncBufferCap=%d, "+
		"waitBuf=%d, ignored=%d", size, d.syncBufferCap, d.waitBufBytes,
		ignore)
}

// ShouldForceSync implements the DirtyBlockCache interface for
// DirtyBlockCacheStandard.
func (d *DirtyBlockCacheStandard) ShouldForceSync(_ tlf.ID) bool {
	d.lock.RLock()
	defer d.lock.RUnlock()
	// TODO: Fill up to likely block boundaries?
	return d.waitBufBytes >= d.syncBufferCap
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
		d.updateWaitBufLocked(req.bytes)
	}
	if d.syncBufBytes != 0 || d.waitBufBytes != 0 || d.ignoreSyncBytes != 0 {
		return fmt.Errorf("Unexpected dirty bytes leftover on shutdown: "+
			"syncBuf=%d, waitBuf=%d, ignore=%d",
			d.syncBufBytes, d.waitBufBytes, d.ignoreSyncBytes)
	}
	return nil
}
