// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/eapache/channels"
	"github.com/keybase/backoff"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	updatePointerPrefetchPriority int           = 1
	prefetchTimeout               time.Duration = 24 * time.Hour
	overallSyncStatusInterval     time.Duration = 1 * time.Second
)

type prefetcherConfig interface {
	syncedTlfGetterSetter
	data.Versioner
	logMaker
	blockCacher
	diskBlockCacheGetter
	clockGetter
	reporterGetter
	settingsDBGetter
}

type prefetchRequest struct {
	ptr            data.BlockPointer
	encodedSize    uint32
	newBlock       func() data.Block
	kmd            libkey.KeyMetadata
	priority       int
	lifetime       data.BlockCacheLifetime
	prefetchStatus PrefetchStatus
	action         BlockRequestAction
	sendCh         chan<- <-chan struct{}

	// obseleted is a channel that can be used to cancel this request while
	// it is waiting in the queue if the prefetch is no longer necessary.
	obseleted <-chan struct{}

	// countedInOverall is true if the bytes of this block are counted
	// in the overall sync status byte total currently.
	countedInOverall bool
}

type ctxPrefetcherTagKey int

const (
	ctxPrefetcherIDKey ctxPrefetcherTagKey = iota
	ctxPrefetchIDKey

	ctxPrefetcherID = "PREID"
	ctxPrefetchID   = "PFID"
)

type prefetch struct {
	subtreeBlockCount int
	subtreeTriggered  bool
	subtreeRetrigger  bool
	req               *prefetchRequest
	// Each refnonce for this block ID can have a different set of
	// parents.  Track the channel for the specific instance of the
	// prefetch that counted us in its progress (since a parent may be
	// canceled and rescheduled later).
	parents map[kbfsblock.RefNonce]map[data.BlockPointer]<-chan struct{}
	ctx     context.Context
	cancel  context.CancelFunc
	waitCh  chan struct{}

	PrefetchProgress
}

func (p *prefetch) Close() {
	select {
	case <-p.waitCh:
	default:
		close(p.waitCh)
	}
	p.cancel()
}

type rescheduledPrefetch struct {
	off   backoff.BackOff
	timer *time.Timer
}

type queuedPrefetch struct {
	waitingPrefetches int
	channel           chan struct{}
	tlfID             tlf.ID
}

type cancelTlfPrefetch struct {
	tlfID   tlf.ID
	channel chan<- struct{}
}

type blockPrefetcher struct {
	ctx    context.Context
	config prefetcherConfig
	log    logger.Logger
	vlog   *libkb.VDebugLog

	makeNewBackOff func() backoff.BackOff

	// blockRetriever to retrieve blocks from the server
	retriever BlockRetriever
	// channel to request prefetches
	prefetchRequestCh channels.Channel
	// channel to cancel prefetches
	prefetchCancelCh channels.Channel
	// channel to cancel all prefetches for a TLF
	prefetchCancelTlfCh channels.Channel
	// channel to reschedule prefetches
	prefetchRescheduleCh channels.Channel
	// channel to get prefetch status
	prefetchStatusCh channels.Channel
	// channel to allow synchronization on completion
	inFlightFetches channels.Channel
	// protects shutdownCh
	shutdownOnce sync.Once
	// channel that is idempotently closed when a shutdown occurs
	shutdownCh chan struct{}
	// channel that is closed when all current fetches are done and prefetches
	// have been triggered
	almostDoneCh chan struct{}
	// channel that is closed when a shutdown completes and all pending
	// prefetch requests are complete
	doneCh chan struct{}
	// map to store prefetch metadata
	prefetches map[kbfsblock.ID]*prefetch
	// map to store backoffs for rescheduling top blocks
	rescheduled map[kbfsblock.ID]*rescheduledPrefetch
	// channel that's always closed, to avoid overhead on certain requests
	closedCh <-chan struct{}

	// map to channels for cancelling queued prefetches
	queuedPrefetchHandlesLock sync.Mutex
	queuedPrefetchHandles     map[data.BlockPointer]queuedPrefetch

	// Tracks the overall bytes currently being prefetched to the sync
	// cache.  The total outstanding bytes resets on the first new
	// prefetch after a completion happens.
	overallSyncStatusLock     sync.RWMutex
	overallSyncStatus         PrefetchProgress
	lastOverallSyncStatusSent time.Time
}

var _ Prefetcher = (*blockPrefetcher)(nil)

func defaultBackOffForPrefetcher() backoff.BackOff {
	return backoff.NewExponentialBackOff()
}

func newBlockPrefetcher(retriever BlockRetriever,
	config prefetcherConfig, testSyncCh <-chan struct{},
	testDoneCh chan<- struct{}) *blockPrefetcher {
	closedCh := make(chan struct{})
	close(closedCh)
	p := &blockPrefetcher{
		config:                config,
		makeNewBackOff:        defaultBackOffForPrefetcher,
		retriever:             retriever,
		prefetchRequestCh:     NewInfiniteChannelWrapper(),
		prefetchCancelCh:      NewInfiniteChannelWrapper(),
		prefetchCancelTlfCh:   NewInfiniteChannelWrapper(),
		prefetchRescheduleCh:  NewInfiniteChannelWrapper(),
		prefetchStatusCh:      NewInfiniteChannelWrapper(),
		inFlightFetches:       NewInfiniteChannelWrapper(),
		shutdownCh:            make(chan struct{}),
		almostDoneCh:          make(chan struct{}, 1),
		doneCh:                make(chan struct{}),
		prefetches:            make(map[kbfsblock.ID]*prefetch),
		queuedPrefetchHandles: make(map[data.BlockPointer]queuedPrefetch),
		rescheduled:           make(map[kbfsblock.ID]*rescheduledPrefetch),
		closedCh:              closedCh,
	}
	if config != nil {
		p.log = config.MakeLogger("PRE")
		p.vlog = config.MakeVLogger(p.log)
	} else {
		p.log = logger.NewNull()
		p.vlog = libkb.NewVDebugLog(p.log)
	}
	p.ctx = CtxWithRandomIDReplayable(context.Background(), ctxPrefetcherIDKey,
		ctxPrefetcherID, p.log)
	if retriever == nil {
		// If we pass in a nil retriever, this prefetcher shouldn't do
		// anything. Treat it as already shut down.
		p.Shutdown()
		close(p.doneCh)
	} else {
		go p.run(testSyncCh, testDoneCh)
		go p.shutdownLoop()
	}
	return p
}

func (p *blockPrefetcher) sendOverallSyncStatusHelperLocked() {
	var status keybase1.FolderSyncStatus
	status.PrefetchProgress = p.overallSyncStatus.ToProtocolProgress(
		p.config.Clock())

	FillInDiskSpaceStatus(
		context.Background(), &status, p.overallSyncStatus.ToProtocolStatus(),
		p.config.DiskBlockCache())

	p.config.Reporter().NotifyOverallSyncStatus(context.Background(), status)
	p.lastOverallSyncStatusSent = p.config.Clock().Now()

}

func (p *blockPrefetcher) sendOverallSyncStatusLocked() {
	// Don't send a new status notification if we aren't complete, and
	// if we have sent one within the last interval.
	if p.overallSyncStatus.SubtreeBytesFetched !=
		p.overallSyncStatus.SubtreeBytesTotal &&
		p.config.Clock().Now().Before(
			p.lastOverallSyncStatusSent.Add(overallSyncStatusInterval)) {
		return
	}

	p.sendOverallSyncStatusHelperLocked()
}

func (p *blockPrefetcher) incOverallSyncTotalBytes(req *prefetchRequest) {
	if !req.action.Sync() || req.countedInOverall {
		return
	}

	p.overallSyncStatusLock.Lock()
	defer p.overallSyncStatusLock.Unlock()
	if p.overallSyncStatus.SubtreeBytesFetched ==
		p.overallSyncStatus.SubtreeBytesTotal {
		// Reset since we had already finished syncing.
		p.overallSyncStatus = PrefetchProgress{}
		p.overallSyncStatus.Start = p.config.Clock().Now()
	}

	p.overallSyncStatus.SubtreeBytesTotal += uint64(req.encodedSize)
	req.countedInOverall = true
	p.sendOverallSyncStatusLocked()
}

func (p *blockPrefetcher) decOverallSyncTotalBytes(req *prefetchRequest) {
	if !req.action.Sync() || !req.countedInOverall {
		return
	}

	p.overallSyncStatusLock.Lock()
	defer p.overallSyncStatusLock.Unlock()
	if p.overallSyncStatus.SubtreeBytesTotal < uint64(req.encodedSize) {
		// Both log and panic so that we get the PFID in the log.
		p.log.CErrorf(
			context.TODO(), "panic: decOverallSyncTotalBytes overstepped "+
				"its bounds (bytes=%d, fetched=%d, total=%d)", req.encodedSize,
			p.overallSyncStatus.SubtreeBytesFetched,
			p.overallSyncStatus.SubtreeBytesTotal)
		panic("decOverallSyncTotalBytes overstepped its bounds")
	}

	p.overallSyncStatus.SubtreeBytesTotal -= uint64(req.encodedSize)
	req.countedInOverall = false
	p.sendOverallSyncStatusLocked()
}

func (p *blockPrefetcher) incOverallSyncFetchedBytes(req *prefetchRequest) {
	if !req.action.Sync() || !req.countedInOverall {
		return
	}

	p.overallSyncStatusLock.Lock()
	defer p.overallSyncStatusLock.Unlock()
	p.overallSyncStatus.SubtreeBytesFetched += uint64(req.encodedSize)
	req.countedInOverall = false
	p.sendOverallSyncStatusLocked()
	if p.overallSyncStatus.SubtreeBytesFetched >
		p.overallSyncStatus.SubtreeBytesTotal {
		// Both log and panic so that we get the PFID in the log.
		p.log.CErrorf(
			context.TODO(), "panic: incOverallSyncFetchedBytes overstepped "+
				"its bounds (fetched=%d, total=%d)",
			p.overallSyncStatus.SubtreeBytesFetched,
			p.overallSyncStatus.SubtreeBytesTotal)
		panic("incOverallSyncFetchedBytes overstepped its bounds")
	}
}

func (p *blockPrefetcher) newPrefetch(
	count int, bytes uint64, triggered bool,
	req *prefetchRequest) *prefetch {
	ctx, cancel := context.WithTimeout(p.ctx, prefetchTimeout)
	ctx = CtxWithRandomIDReplayable(
		ctx, ctxPrefetchIDKey, ctxPrefetchID, p.log)
	p.incOverallSyncTotalBytes(req)
	return &prefetch{
		subtreeBlockCount: count,
		subtreeTriggered:  triggered,
		req:               req,
		parents:           make(map[kbfsblock.RefNonce]map[data.BlockPointer]<-chan struct{}),
		ctx:               ctx,
		cancel:            cancel,
		waitCh:            make(chan struct{}),
		PrefetchProgress: PrefetchProgress{
			SubtreeBytesTotal: bytes,
			Start:             p.config.Clock().Now(),
		},
	}
}

func (p *blockPrefetcher) getParentForApply(
	pptr data.BlockPointer, refMap map[data.BlockPointer]<-chan struct{},
	ch <-chan struct{}) *prefetch {
	// Check if the particular prefetch for our parent that we're
	// tracking has already completed or been canceled, and if so,
	// don't apply to that parent.  This can happen in the following
	// scenario:
	//
	// * A path `a/b/c` gets prefetched.
	// * The path gets updated via another write to `a'/b'/c`.
	// * `a` and `b` get canceled.
	// * `a` gets re-fetched, and `b` gets added to the prefetch list.
	// * `c` completes and tries to complete its old parent `b`, which
	//   prematurely closes the new prefetches for `b` and `c` (which
	//   are now only expecting one block, the new `b` prefetch).
	parentDone := false
	select {
	case <-ch:
		parentDone = true
	default:
	}

	parent, ok := p.prefetches[pptr.ID]
	if parentDone || !ok {
		// Note that the parent (or some other ancestor) might be
		// rescheduled for later and have been removed from
		// `prefetches`.  In that case still delete it from the
		// `parents` list as normal; the reschedule will add it
		// back in later as needed.
		delete(refMap, pptr)
		return nil
	}
	return parent
}

// applyToPtrParentsRecursive applies a function just to the parents
// of the specific pointer (with refnonce).
func (p *blockPrefetcher) applyToPtrParentsRecursive(
	f func(data.BlockPointer, *prefetch), ptr data.BlockPointer, pre *prefetch) {
	defer func() {
		if r := recover(); r != nil {
			id := kbfsblock.ZeroID
			if pre.req != nil {
				id = pre.req.ptr.ID
			}
			p.log.CErrorf(pre.ctx, "Next prefetch in panic unroll: id=%s, "+
				"subtreeBlockCount=%d, subtreeTriggered=%t, parents=%+v",
				id, pre.subtreeBlockCount, pre.subtreeTriggered, pre.parents)
			panic(r)
		}
	}()
	refMap := pre.parents[ptr.RefNonce]
	for pptr, ch := range refMap {
		parent := p.getParentForApply(pptr, refMap, ch)
		if parent != nil {
			p.applyToPtrParentsRecursive(f, pptr, parent)
		}
	}
	if len(pre.parents[ptr.RefNonce]) == 0 {
		delete(pre.parents, ptr.RefNonce)
	}
	f(ptr, pre)
}

// applyToParentsRecursive applies a function to all the parents of
// the pointer (with any refnonces).
func (p *blockPrefetcher) applyToParentsRecursive(
	f func(kbfsblock.ID, *prefetch), blockID kbfsblock.ID, pre *prefetch) {
	defer func() {
		if r := recover(); r != nil {
			id := kbfsblock.ZeroID
			if pre.req != nil {
				id = pre.req.ptr.ID
			}
			p.log.CErrorf(pre.ctx, "Next prefetch in panic unroll: id=%s, "+
				"subtreeBlockCount=%d, subtreeTriggered=%t, parents=%+v",
				id, pre.subtreeBlockCount, pre.subtreeTriggered, pre.parents)
			panic(r)
		}
	}()
	for refNonce, refMap := range pre.parents {
		for pptr, ch := range refMap {
			parent := p.getParentForApply(pptr, refMap, ch)
			if parent != nil {
				p.applyToParentsRecursive(f, pptr.ID, parent)
			}
		}
		if len(refMap) == 0 {
			delete(pre.parents, refNonce)
		}
	}
	f(blockID, pre)
}

func (p *blockPrefetcher) getBlockSynchronously(
	ctx context.Context, req *prefetchRequest, action BlockRequestAction) (
	data.Block, error) {
	// Avoid the overhead of the block retriever copy if possible.
	cachedBlock, err := p.config.BlockCache().Get(req.ptr)
	if err == nil {
		return cachedBlock, nil
	}

	b := req.newBlock()
	err = <-p.retriever.Request(
		ctx, defaultOnDemandRequestPriority, req.kmd, req.ptr,
		b, req.lifetime, action)
	if err != nil {
		return nil, err
	}
	return b, nil
}

// Walk up the block tree decrementing each node by `numBlocks`. Any
// zeroes we hit get marked complete and deleted.  Also, count
// `numBytes` bytes as being fetched.  If the block count becomes 0,
// then the total number of bytes must now be fetched.
// TODO: If we ever hit a lower number than the child, panic.
func (p *blockPrefetcher) completePrefetch(
	numBlocks int, numBytes uint64) func(kbfsblock.ID, *prefetch) {
	return func(blockID kbfsblock.ID, pp *prefetch) {
		pp.subtreeBlockCount -= numBlocks
		pp.SubtreeBytesFetched += numBytes
		if pp.subtreeBlockCount < 0 {
			// Both log and panic so that we get the PFID in the log.
			p.log.CErrorf(pp.ctx, "panic: completePrefetch overstepped its "+
				"bounds")
			panic("completePrefetch overstepped its bounds")
		}
		if pp.req == nil {
			p.log.CErrorf(pp.ctx, "panic: completePrefetch got a nil req "+
				"for block %s", blockID)
			panic("completePrefetch got a nil req")
		}
		if pp.subtreeBlockCount == 0 {
			if pp.SubtreeBytesFetched != pp.SubtreeBytesTotal {
				panic(fmt.Sprintf("Bytes fetch mismatch: fetched=%d, total=%d",
					pp.SubtreeBytesFetched, pp.SubtreeBytesTotal))
			}
			delete(p.prefetches, blockID)
			p.clearRescheduleState(blockID)
			delete(p.rescheduled, blockID)
			defer pp.Close()
			b, err := p.getBlockSynchronously(pp.ctx, pp.req, BlockRequestSolo)
			if err != nil {
				p.log.CWarningf(pp.ctx, "failed to retrieve block to "+
					"complete its prefetch, canceled it instead: %+v", err)
				return
			}
			err = p.retriever.PutInCaches(pp.ctx, pp.req.ptr,
				pp.req.kmd.TlfID(), b, pp.req.lifetime,
				FinishedPrefetch, pp.req.action.CacheType())
			if err != nil {
				p.log.CWarningf(pp.ctx, "failed to complete prefetch due to "+
					"cache error, canceled it instead: %+v", err)
			}
		}
	}
}

func (p *blockPrefetcher) decrementPrefetch(blockID kbfsblock.ID, pp *prefetch) {
	pp.subtreeBlockCount--
	if pp.subtreeBlockCount < 0 {
		// Both log and panic so that we get the PFID in the log.
		p.log.CErrorf(pp.ctx, "panic: decrementPrefetch overstepped its bounds")
		panic("decrementPrefetch overstepped its bounds")
	}
}

func (p *blockPrefetcher) addFetchedBytes(bytes uint64) func(
	kbfsblock.ID, *prefetch) {
	return func(blockID kbfsblock.ID, pp *prefetch) {
		pp.SubtreeBytesFetched += bytes
		if pp.SubtreeBytesFetched > pp.SubtreeBytesTotal {
			// Both log and panic so that we get the PFID in the log.
			p.log.CErrorf(pp.ctx, "panic: addFetchedBytes overstepped "+
				"its bounds (fetched=%d, total=%d)", pp.SubtreeBytesFetched,
				pp.SubtreeBytesTotal)
			panic("addFetchedBytes overstepped its bounds")
		}
	}
}

func (p *blockPrefetcher) clearRescheduleState(blockID kbfsblock.ID) {
	rp, ok := p.rescheduled[blockID]
	if !ok {
		return
	}
	if rp.timer != nil {
		rp.timer.Stop()
		rp.timer = nil
	}
}

func (p *blockPrefetcher) cancelQueuedPrefetch(ptr data.BlockPointer) {
	p.queuedPrefetchHandlesLock.Lock()
	defer p.queuedPrefetchHandlesLock.Unlock()
	qp, ok := p.queuedPrefetchHandles[ptr]
	if ok {
		close(qp.channel)
		delete(p.queuedPrefetchHandles, ptr)
		p.log.Debug("cancelled queued prefetch for block %s", ptr)
	} else {
		p.vlog.Log(libkb.VLog2, "nothing to cancel for block %s", ptr)
	}
}

func (p *blockPrefetcher) cancelQueuedPrefetchesForTlf(tlfID tlf.ID) {
	p.queuedPrefetchHandlesLock.Lock()
	defer p.queuedPrefetchHandlesLock.Unlock()
	for ptr, qp := range p.queuedPrefetchHandles {
		if qp.tlfID != tlfID {
			continue
		}

		p.vlog.Log(
			libkb.VLog2, "Canceling queued prefetch for %s, tlf=%s", ptr, tlfID)
		close(qp.channel)
		delete(p.queuedPrefetchHandles, ptr)
	}
}

func (p *blockPrefetcher) markQueuedPrefetchDone(ptr data.BlockPointer) {
	p.queuedPrefetchHandlesLock.Lock()
	defer p.queuedPrefetchHandlesLock.Unlock()
	qp, present := p.queuedPrefetchHandles[ptr]
	if !present {
		p.vlog.CLogf(
			context.Background(), libkb.VLog2, "queuedPrefetch not present in"+
				" queuedPrefetchHandles: %s", ptr)
		return
	}
	if qp.waitingPrefetches == 1 {
		delete(p.queuedPrefetchHandles, ptr)
	} else {
		p.queuedPrefetchHandles[ptr] = queuedPrefetch{
			qp.waitingPrefetches - 1, qp.channel, qp.tlfID}
	}
}

func (p *blockPrefetcher) doCancel(id kbfsblock.ID, pp *prefetch) {
	p.decOverallSyncTotalBytes(pp.req)
	delete(p.prefetches, id)
	pp.Close()
	p.clearRescheduleState(id)
	delete(p.rescheduled, id)
}

func (p *blockPrefetcher) cancelPrefetch(ptr data.BlockPointer, pp *prefetch) {
	delete(pp.parents, ptr.RefNonce)
	if len(pp.parents) > 0 {
		return
	}
	p.doCancel(ptr.ID, pp)
}

// shutdownLoop tracks in-flight requests
func (p *blockPrefetcher) shutdownLoop() {
top:
	for {
		select {
		case chInterface := <-p.inFlightFetches.Out():
			ch := chInterface.(<-chan error)
			<-ch
		case <-p.shutdownCh:
			break top
		}
	}
	for p.inFlightFetches.Len() > 0 {
		chInterface := <-p.inFlightFetches.Out()
		ch := chInterface.(<-chan error)
		<-ch
	}
	p.almostDoneCh <- struct{}{}
}

// calculatePriority returns either a base priority for an unsynced TLF or a
// high priority for a synced TLF.
func (p *blockPrefetcher) calculatePriority(
	basePriority int, action BlockRequestAction) int {
	// A prefetched, non-deep-synced child always gets throttled for
	// now, until we fix the database performance issues.
	if basePriority > throttleRequestPriority && !action.DeepSync() {
		basePriority = throttleRequestPriority
	}
	return basePriority - 1
}

// removeFinishedParent removes a parent from the given refmap if it's
// finished or is otherwise no longer a prefetch in progress.
func (p *blockPrefetcher) removeFinishedParent(
	pptr data.BlockPointer, refMap map[data.BlockPointer]<-chan struct{},
	ch <-chan struct{}) {
	_ = p.getParentForApply(pptr, refMap, ch)
}

// request maps the parent->child block relationship in the prefetcher, and it
// triggers child prefetches that aren't already in progress.
func (p *blockPrefetcher) request(ctx context.Context, priority int,
	kmd libkey.KeyMetadata, info data.BlockInfo, block data.Block,
	lifetime data.BlockCacheLifetime, parentPtr data.BlockPointer,
	isParentNew bool, action BlockRequestAction,
	idsSeen map[kbfsblock.ID]bool) (
	numBlocks int, numBytesFetched, numBytesTotal uint64) {
	ptr := info.BlockPointer
	if idsSeen[ptr.ID] {
		return 0, 0, 0
	}
	idsSeen[ptr.ID] = true

	// If the prefetch is already waiting, don't make it wait again.
	// Add the parent, however.
	pre, isPrefetchWaiting := p.prefetches[ptr.ID]
	if !isPrefetchWaiting {
		// If the block isn't in the tree, we add it with a block count of 1 (a
		// later TriggerPrefetch will come in and decrement it).
		obseleted := make(chan struct{})
		req := &prefetchRequest{
			ptr, info.EncodedSize, block.NewEmptier(), kmd, priority,
			lifetime, NoPrefetch, action, nil, obseleted, false}

		pre = p.newPrefetch(1, uint64(info.EncodedSize), false, req)
		p.prefetches[ptr.ID] = pre
	}
	// If this is a new prefetch, or if we need to update the action,
	// send a new request.
	newAction := action.Combine(pre.req.action)
	if !isPrefetchWaiting || pre.req.action != newAction || pre.req.ptr != ptr {
		// Update the action to prevent any early cancellation of a
		// previous, non-deeply-synced request, and trigger a new
		// request in case the previous request has already been
		// handled.
		oldAction := pre.req.action
		pre.req.action = newAction
		if !oldAction.Sync() && newAction.Sync() {
			p.incOverallSyncTotalBytes(pre.req)
			// Delete the old parent waitCh if it's been canceled already.
			if ch, ok := pre.parents[ptr.RefNonce][parentPtr]; ok {
				p.removeFinishedParent(parentPtr, pre.parents[ptr.RefNonce], ch)
			}
			if pre.subtreeTriggered {
				// Since this fetch is being converted into a sync, we
				// need to re-trigger all the child fetches to be
				// syncs as well.
				pre.subtreeRetrigger = true
			}
		}

		ch := p.retriever.Request(
			pre.ctx, priority, kmd, ptr, block.NewEmpty(), lifetime,
			action.DelayedCacheCheckAction())
		p.inFlightFetches.In() <- ch
	}
	parentPre, isParentWaiting := p.prefetches[parentPtr.ID]
	if !isParentWaiting {
		p.vlog.CLogf(pre.ctx, libkb.VLog2,
			"prefetcher doesn't know about parent block "+
				"%s for child block %s", parentPtr, ptr.ID)
		panic("prefetcher doesn't know about parent block when trying to " +
			"record parent-child relationship")
	}
	if pre.parents[ptr.RefNonce][parentPtr] == nil || isParentNew {
		// The new parent needs its subtree block count increased. This can
		// happen either when:
		// 1. The child doesn't know about the parent when the child is first
		// created above, or the child was previously in the tree but the
		// parent was not (e.g. when there's an updated parent due to a change
		// in a sibling of this child).
		// 2. The parent is newly created but the child _did_ know about it,
		// like when the parent previously had a prefetch but was canceled.
		if len(pre.parents[ptr.RefNonce]) == 0 {
			pre.parents[ptr.RefNonce] = make(map[data.BlockPointer]<-chan struct{})
		}
		pre.parents[ptr.RefNonce][parentPtr] = parentPre.waitCh
		if pre.subtreeBlockCount > 0 {
			p.vlog.CLogf(ctx, libkb.VLog2,
				"Prefetching %v, action=%s, numBlocks=%d, isParentNew=%t",
				ptr, action, pre.subtreeBlockCount, isParentNew)
		}
		return pre.subtreeBlockCount, pre.SubtreeBytesFetched,
			pre.SubtreeBytesTotal
	}
	return 0, 0, 0
}

func (p *blockPrefetcher) handleStatusRequest(req *prefetchStatusRequest) {
	pre, isPrefetchWaiting := p.prefetches[req.ptr.ID]
	if !isPrefetchWaiting {
		req.ch <- PrefetchProgress{}
	} else {
		req.ch <- pre.PrefetchProgress
	}
}

// handleCriticalRequests should be called periodically during any
// long prefetch requests, to make sure we handle critical requests
// quickly.  These are requests that are required to be run in the
// main processing goroutine, but won't interfere with whatever
// request we're in the middle of.
func (p *blockPrefetcher) handleCriticalRequests() {
	for {
		// Fulfill any status requests since the user could be waiting
		// for them.
		select {
		case req := <-p.prefetchStatusCh.Out():
			p.handleStatusRequest(req.(*prefetchStatusRequest))
		default:
			return
		}
	}
}

func (p *blockPrefetcher) prefetchIndirectFileBlock(
	ctx context.Context, parentPtr data.BlockPointer, b *data.FileBlock,
	kmd libkey.KeyMetadata, lifetime data.BlockCacheLifetime, isPrefetchNew bool,
	action BlockRequestAction, basePriority int) (
	numBlocks int, numBytesFetched, numBytesTotal uint64, isTail bool) {
	// Prefetch indirect block pointers.
	newPriority := p.calculatePriority(basePriority, action)
	idsSeen := make(map[kbfsblock.ID]bool, len(b.IPtrs))
	for _, ptr := range b.IPtrs {
		b, f, t := p.request(
			ctx, newPriority, kmd, ptr.BlockInfo, b.NewEmpty(), lifetime,
			parentPtr, isPrefetchNew, action, idsSeen)
		numBlocks += b
		numBytesFetched += f
		numBytesTotal += t

		p.handleCriticalRequests()
	}
	return numBlocks, numBytesFetched, numBytesTotal, len(b.IPtrs) == 0
}

func (p *blockPrefetcher) prefetchIndirectDirBlock(
	ctx context.Context, parentPtr data.BlockPointer, b *data.DirBlock,
	kmd libkey.KeyMetadata, lifetime data.BlockCacheLifetime, isPrefetchNew bool,
	action BlockRequestAction, basePriority int) (
	numBlocks int, numBytesFetched, numBytesTotal uint64, isTail bool) {
	// Prefetch indirect block pointers.
	newPriority := p.calculatePriority(basePriority, action)
	idsSeen := make(map[kbfsblock.ID]bool, len(b.IPtrs))
	for _, ptr := range b.IPtrs {
		b, f, t := p.request(
			ctx, newPriority, kmd, ptr.BlockInfo, b.NewEmpty(), lifetime,
			parentPtr, isPrefetchNew, action, idsSeen)
		numBlocks += b
		numBytesFetched += f
		numBytesTotal += t

		p.handleCriticalRequests()
	}
	return numBlocks, numBytesFetched, numBytesTotal, len(b.IPtrs) == 0
}

func (p *blockPrefetcher) prefetchDirectDirBlock(
	ctx context.Context, parentPtr data.BlockPointer, b *data.DirBlock,
	kmd libkey.KeyMetadata, lifetime data.BlockCacheLifetime, isPrefetchNew bool,
	action BlockRequestAction, basePriority int) (
	numBlocks int, numBytesFetched, numBytesTotal uint64, isTail bool) {
	// Prefetch all DirEntry root blocks.
	dirEntries := data.DirEntriesBySizeAsc{
		DirEntries: data.DirEntryMapToDirEntries(b.Children),
	}
	sort.Sort(dirEntries)
	newPriority := p.calculatePriority(basePriority, action)
	totalChildEntries := 0
	idsSeen := make(map[kbfsblock.ID]bool, len(dirEntries.DirEntries))
	for _, entry := range dirEntries.DirEntries {
		var block data.Block
		switch entry.Type {
		case data.Dir:
			block = &data.DirBlock{}
		case data.File:
			block = &data.FileBlock{}
		case data.Exec:
			block = &data.FileBlock{}
		case data.Sym:
			// Skip symbolic links because there's nothing to prefetch.
			continue
		default:
			p.log.CDebugf(ctx, "Skipping prefetch for entry of "+
				"unknown type %d", entry.Type)
			continue
		}
		totalChildEntries++
		b, f, t := p.request(
			ctx, newPriority, kmd, entry.BlockInfo, block, lifetime,
			parentPtr, isPrefetchNew, action, idsSeen)
		numBlocks += b
		numBytesFetched += f
		numBytesTotal += t

		p.handleCriticalRequests()
	}
	if totalChildEntries == 0 {
		isTail = true
	}
	return numBlocks, numBytesFetched, numBytesTotal, isTail
}

// handlePrefetch allows the prefetcher to trigger prefetches. `run` calls this
// when a prefetch request is received and the criteria are satisfied to
// initiate a prefetch for this block's children.
// Returns `numBlocks` which indicates how many additional blocks (blocks not
// currently in the prefetch tree) with a parent of `pre.req.ptr.ID` must be
// added to the tree.
func (p *blockPrefetcher) handlePrefetch(
	pre *prefetch, isPrefetchNew bool, action BlockRequestAction, b data.Block) (
	numBlocks int, numBytesFetched, numBytesTotal uint64, isTail bool,
	err error) {
	req := pre.req
	childAction := action.ChildAction(b)
	switch b := b.(type) {
	case *data.FileBlock:
		if b.IsInd {
			numBlocks, numBytesFetched, numBytesTotal, isTail =
				p.prefetchIndirectFileBlock(
					pre.ctx, req.ptr, b, req.kmd, req.lifetime,
					isPrefetchNew, childAction, req.priority)
		} else {
			isTail = true
		}
	case *data.DirBlock:
		if b.IsInd {
			numBlocks, numBytesFetched, numBytesTotal, isTail =
				p.prefetchIndirectDirBlock(
					pre.ctx, req.ptr, b, req.kmd, req.lifetime,
					isPrefetchNew, childAction, req.priority)
		} else {
			numBlocks, numBytesFetched, numBytesTotal, isTail =
				p.prefetchDirectDirBlock(
					pre.ctx, req.ptr, b, req.kmd, req.lifetime,
					isPrefetchNew, childAction, req.priority)
		}
	default:
		// Skipping prefetch for block of unknown type (likely CommonBlock)
		return 0, 0, 0, false, errors.New("unknown block type")
	}
	return numBlocks, numBytesFetched, numBytesTotal, isTail, nil
}

func (p *blockPrefetcher) rescheduleTopBlock(
	blockID kbfsblock.ID, pp *prefetch) {
	// If this block has parents and thus is not a top-block, cancel
	// all of the references for it.
	if len(pp.parents) > 0 {
		for refNonce := range pp.parents {
			p.cancelPrefetch(data.BlockPointer{
				ID:      blockID,
				Context: kbfsblock.Context{RefNonce: refNonce},
			}, pp)
		}
		return
	}

	// Effectively below we are transferring the request for the top
	// block from `p.prefetches` to `p.rescheduled`.
	delete(p.prefetches, blockID)
	pp.Close()

	// Only reschedule the top-most blocks, which has no parents.
	rp, ok := p.rescheduled[blockID]
	if !ok {
		rp = &rescheduledPrefetch{
			off: p.makeNewBackOff(),
		}
		p.rescheduled[blockID] = rp
	}

	if rp.timer != nil {
		// Prefetch already scheduled.
		return
	}
	// Copy the req, re-using the same Block as before.
	req := *pp.req
	d := rp.off.NextBackOff()
	if d == backoff.Stop {
		p.log.Debug("Stopping rescheduling of %s due to stopped backoff timer",
			blockID)
		return
	}
	p.log.Debug("Rescheduling prefetch of %s in %s", blockID, d)
	rp.timer = time.AfterFunc(d, func() {
		p.triggerPrefetch(&req)
	})
}

func (p *blockPrefetcher) reschedulePrefetch(req *prefetchRequest) {
	select {
	case p.prefetchRescheduleCh.In() <- req:
	case <-p.shutdownCh:
		p.log.Warning("Skipping prefetch reschedule for block %v since "+
			"the prefetcher is shutdown", req.ptr.ID)
	}
}

func (p *blockPrefetcher) sendOverallSyncStatusNotification() {
	p.overallSyncStatusLock.Lock()
	defer p.overallSyncStatusLock.Unlock()
	p.sendOverallSyncStatusHelperLocked()
}

func (p *blockPrefetcher) stopIfNeeded(
	ctx context.Context, req *prefetchRequest) (doStop, doCancel bool) {
	dbc := p.config.DiskBlockCache()
	if dbc == nil {
		return false, false
	}
	hasRoom, howMuchRoom, err := dbc.DoesCacheHaveSpace(ctx, req.action.CacheType())
	if err != nil {
		p.log.CDebugf(ctx, "Error checking space: +%v", err)
		return false, false
	}
	if hasRoom {
		db := p.config.GetSettingsDB()
		if db != nil {
			if settings, err := db.Settings(ctx); err == nil &&
				req.action.CacheType() == DiskBlockSyncCache &&
				howMuchRoom < settings.SpaceAvailableNotificationThreshold {
				// If a notification threshold is configured, we send a
				// notificaiton here.
				p.sendOverallSyncStatusNotification()
			}
		}
		return false, false
	}

	defer func() {
		if doStop {
			p.vlog.CLogf(ctx, libkb.VLog2,
				"stopping prefetch for block %s due to full cache (sync=%t)",
				req.ptr.ID, req.action.Sync())
		}
	}()

	if req.action.Sync() {
		// If the sync cache is close to full, reschedule the prefetch.
		p.reschedulePrefetch(req)
		p.sendOverallSyncStatusNotification()
		return true, false
	}

	// Otherwise, only stop if we're supposed to stop when full.
	doStop = req.action.StopIfFull()
	if doStop {
		doCancel = true
	}
	return doStop, doCancel
}

type prefetchStatusRequest struct {
	ptr data.BlockPointer
	ch  chan<- PrefetchProgress
}

func (p *blockPrefetcher) handlePrefetchRequest(req *prefetchRequest) {
	pre, isPrefetchWaiting := p.prefetches[req.ptr.ID]
	if isPrefetchWaiting && pre.req == nil {
		// If this prefetch already appeared in the tree, ensure it
		// has a req associated with it.
		pre.req = req
	}

	p.clearRescheduleState(req.ptr.ID)

	// If this request is just asking for the wait channel,
	// send it now.  (This is processed in the same queue as
	// the prefetch requests, to guarantee an initial prefetch
	// request has always been processed before the wait
	// channel request is processed.)
	if req.sendCh != nil {
		if !isPrefetchWaiting {
			req.sendCh <- p.closedCh
		} else {
			req.sendCh <- pre.waitCh
		}
		return
	}

	select {
	case <-req.obseleted:
		// This request was cancelled while it was waiting.
		p.vlog.CLogf(context.Background(), libkb.VLog2,
			"Request not processing because it was canceled already"+
				": ptr=%s action=%v", req.ptr, req.action)
		return
	default:
		p.markQueuedPrefetchDone(req.ptr)
	}

	if isPrefetchWaiting {
		select {
		case <-pre.ctx.Done():
			p.vlog.CLogf(context.Background(), libkb.VLog2,
				"Request not processing because it was canceled "+
					"already: id=%v action=%v", req.ptr.ID, req.action)
			return
		default:
		}
	}

	ctx := context.TODO()
	if isPrefetchWaiting {
		ctx = pre.ctx
	}
	p.vlog.CLogf(ctx, libkb.VLog2, "Handling request for %v, action=%s",
		req.ptr, req.action)

	// Ensure the block is in the right cache.
	b, err := p.getBlockSynchronously(ctx, req, req.action.SoloAction())
	if err != nil {
		p.log.CWarningf(ctx, "error requesting for block %s: "+
			"%+v", req.ptr.ID, err)
		// There's nothing for us to do when there's an error.
		return
	}

	// Update the priority and action of any existing
	// prefetch, and count it in the overall sync status if
	// needed.
	newAction := req.action
	oldAction := newAction
	if isPrefetchWaiting {
		if req.priority > pre.req.priority {
			pre.req.priority = req.priority
		}

		oldAction = pre.req.action
		newAction = oldAction.Combine(newAction)
		if newAction != pre.req.action {
			// This can happen for example if the prefetcher
			// doesn't know about a deep sync but now one has
			// been created.
			pre.req.action = newAction
		}

		if !oldAction.Sync() && newAction.Sync() {
			// This request turned into a syncing request, so
			// update the overall sync status.
			p.incOverallSyncTotalBytes(pre.req)
		}
	}

	defer func() {
		if pre != nil {
			// We definitely have the block, so update the total
			// fetched bytes as needed.
			p.incOverallSyncFetchedBytes(pre.req)
		}
	}()

	// If the request is finished (i.e., if it's marked as
	// finished or if it has no child blocks to fetch), then
	// complete the prefetch.
	if req.prefetchStatus == FinishedPrefetch || b.IsTail() {
		// First we handle finished prefetches.
		if isPrefetchWaiting {
			if pre.subtreeBlockCount < 0 {
				// Both log and panic so that we get the PFID in the
				// log.
				p.log.CErrorf(ctx, "the subtreeBlockCount for a "+
					"block should never be < 0")
				panic("the subtreeBlockCount for a block should " +
					"never be < 0")
			}
			// Since we decrement by `pre.subtreeBlockCount`, we're
			// guaranteed that `pre` will be removed from the
			// prefetcher.
			numBytes := pre.SubtreeBytesTotal - pre.SubtreeBytesFetched
			p.applyToParentsRecursive(
				p.completePrefetch(pre.subtreeBlockCount, numBytes),
				req.ptr.ID, pre)
		} else {
			p.vlog.CLogf(ctx, libkb.VLog2,
				"skipping prefetch for finished block %s", req.ptr.ID)
			if req.prefetchStatus != FinishedPrefetch {
				// Mark this block as finished in the cache.
				err = p.retriever.PutInCaches(
					ctx, req.ptr, req.kmd.TlfID(), b, req.lifetime,
					FinishedPrefetch, req.action.CacheType())
				if err != nil {
					p.vlog.CLogf(ctx, libkb.VLog2,
						"Couldn't put finished block %s in cache: %+v",
						req.ptr, err)
				}
			}
		}
		// Always short circuit a finished prefetch.
		return
	}
	if !req.action.Prefetch(b) {
		p.vlog.CLogf(ctx, libkb.VLog2,
			"skipping prefetch for block %s, action %s",
			req.ptr.ID, req.action)
		if isPrefetchWaiting && !oldAction.Prefetch(b) {
			// Cancel this prefetch if we're skipping it and
			// there's not already another prefetch in
			// progress.  It's not a tail block since that
			// case is caught above, so we are definitely
			// giving up here without fetching its children.
			p.applyToPtrParentsRecursive(p.cancelPrefetch, req.ptr, pre)
		}
		return
	}
	if req.prefetchStatus == TriggeredPrefetch &&
		!newAction.DeepSync() &&
		(isPrefetchWaiting &&
			newAction.Sync() == oldAction.Sync() &&
			newAction.StopIfFull() == oldAction.StopIfFull()) {
		p.vlog.CLogf(ctx, libkb.VLog2,
			"prefetch already triggered for block ID %s", req.ptr.ID)
		return
	}

	// Bail out early if we know the cache is already full, to
	// avoid enqueuing the child blocks when they aren't able
	// to be cached.
	if doStop, doCancel := p.stopIfNeeded(ctx, req); doStop {
		if doCancel && isPrefetchWaiting {
			p.applyToPtrParentsRecursive(p.cancelPrefetch, req.ptr, pre)
		}
		return
	}

	if isPrefetchWaiting {
		switch {
		case pre.subtreeRetrigger:
			p.vlog.CLogf(
				ctx, libkb.VLog2,
				"retriggering prefetch subtree for block ID %s", req.ptr.ID)
			pre.subtreeRetrigger = false
		case pre.subtreeTriggered:
			p.vlog.CLogf(
				ctx, libkb.VLog2, "prefetch subtree already triggered "+
					"for block ID %s", req.ptr.ID)
			// Redundant prefetch request.
			// We've already seen _this_ block, and already triggered
			// prefetches for its children. No use doing it again!
			if pre.subtreeBlockCount == 0 {
				// Only this block is left, and we didn't prefetch on a
				// previous prefetch through to the tail. So we cancel
				// up the tree. This still allows upgrades from an
				// unsynced block to a synced block, since p.prefetches
				// should be ephemeral.
				p.applyToPtrParentsRecursive(
					p.cancelPrefetch, req.ptr, pre)
			}
			if newAction == oldAction {
				// Short circuit prefetches if the subtree was
				// already triggered, unless we've changed the
				// prefetch action.
				return
			}
		default:
			// This block was in the tree and thus was counted, but now
			// it has been successfully fetched. We need to percolate
			// that information up the tree.
			if pre.subtreeBlockCount == 0 {
				// Both log and panic so that we get the PFID in the
				// log.
				p.log.CErrorf(ctx, "prefetch was in the tree, "+
					"wasn't triggered, but had a block count of 0")
				panic("prefetch was in the tree, wasn't triggered, " +
					"but had a block count of 0")
			}
			p.applyToParentsRecursive(
				p.decrementPrefetch, req.ptr.ID, pre)
			bytes := uint64(b.GetEncodedSize())
			p.applyToParentsRecursive(
				p.addFetchedBytes(bytes), req.ptr.ID, pre)
			pre.subtreeTriggered = true
		}
	} else {
		// Ensure we have a prefetch to work with.
		// If the prefetch is to be tracked, then the 0
		// `subtreeBlockCount` will be incremented by `numBlocks`
		// below, once we've ensured that `numBlocks` is not 0.
		pre = p.newPrefetch(0, 0, true, req)
		p.prefetches[req.ptr.ID] = pre
		ctx = pre.ctx
		p.vlog.CLogf(ctx, libkb.VLog2,
			"created new prefetch for block %s", req.ptr.ID)
	}

	// TODO: There is a potential optimization here that we can
	// consider: Currently every time a prefetch is triggered, we
	// iterate through all the block's child pointers. This is short
	// circuited in `TriggerPrefetch` and here in various conditions.
	// However, for synced trees we ignore that and prefetch anyway. So
	// here we would need to figure out a heuristic to avoid that
	// iteration.
	//
	// `numBlocks` now represents only the number of blocks to add
	// to the tree from `pre` to its roots, inclusive.
	numBlocks, numBytesFetched, numBytesTotal, isTail, err :=
		p.handlePrefetch(pre, !isPrefetchWaiting, req.action, b)
	if err != nil {
		p.log.CWarningf(ctx, "error handling prefetch for block %s: "+
			"%+v", req.ptr.ID, err)
		// There's nothing for us to do when there's an error.
		return
	}
	if isTail {
		p.vlog.CLogf(ctx, libkb.VLog2,
			"completed prefetch for tail block %s ", req.ptr.ID)
		// This is a tail block with no children.  Parent blocks are
		// potentially waiting for this prefetch, so we percolate the
		// information up the tree that this prefetch is done.
		//
		// Note that only a tail block or cached block with
		// `FinishedPrefetch` can trigger a completed prefetch.
		//
		// We use 0 as our completion number because we've already
		// decremented above as appropriate. This just walks up the
		// tree removing blocks with a 0 subtree. We couldn't do that
		// above because `handlePrefetch` potentially adds blocks.
		// TODO: think about whether a refactor can be cleanly done to
		// only walk up the tree once. We'd track a `numBlocks` and
		// complete or decrement as appropriate.
		p.applyToParentsRecursive(
			p.completePrefetch(0, 0), req.ptr.ID, pre)
		return
	}
	// This is not a tail block.
	if numBlocks == 0 {
		p.vlog.CLogf(ctx, libkb.VLog2,
			"no blocks to prefetch for block %s", req.ptr.ID)
		// All the blocks to be triggered have already done so. Do
		// nothing.  This is simply an optimization to avoid crawling
		// the tree.
		return
	}
	if !isPrefetchWaiting {
		p.vlog.CLogf(ctx, libkb.VLog2,
			"adding block %s to the prefetch tree", req.ptr)
		// This block doesn't appear in the prefetch tree, so it's the
		// root of a new prefetch tree. Add it to the tree.
		p.prefetches[req.ptr.ID] = pre
		// One might think that since this block wasn't in the tree, we
		// need to `numBlocks++`. But since we're in this flow, the
		// block has already been fetched and is thus done.  So it
		// shouldn't block anything above it in the tree from
		// completing.
	}
	p.vlog.CLogf(ctx, libkb.VLog2,
		"prefetching %d block(s) with parent block %s "+
			"[bytesFetched=%d, bytesTotal=%d]",
		numBlocks, req.ptr.ID, numBytesFetched, numBytesTotal)
	// Walk up the block tree and add numBlocks to every parent,
	// starting with this block.
	p.applyToParentsRecursive(func(blockID kbfsblock.ID, pp *prefetch) {
		pp.subtreeBlockCount += numBlocks
		pp.SubtreeBytesFetched += numBytesFetched
		pp.SubtreeBytesTotal += numBytesTotal
	}, req.ptr.ID, pre)
	// Ensure this block's status is marked as triggered.  If
	// it was rescheduled due to a previously-full cache, it
	// might not yet be set.
	dbc := p.config.DiskBlockCache()
	if dbc != nil {
		err := dbc.UpdateMetadata(
			pre.ctx, req.kmd.TlfID(), req.ptr.ID, TriggeredPrefetch,
			req.action.CacheType())
		if err != nil {
			p.log.CDebugf(pre.ctx,
				"Couldn't update metadata for block %s, action=%s",
				req.ptr.ID, pre.req.action)
		}
	}
}

// run prefetches blocks.
// E.g. a synced prefetch:
// a -> {b -> {c, d}, e -> {f, g}}:
// * state of prefetch tree in `p.prefetches`.
// 1) a is fetched, triggers b and e.
//    * a:2 -> {b:1, e:1}
// 2) b is fetched, decrements b and a by 1, and triggers c and d to increment
//    b and a by 2.
//    * a:3 -> {b:2 -> {c:1, d:1}, e:1}
// 3) c is fetched, and isTail==true so it completes up the tree.
//    * a:2 -> {b:1 -> {d:1}, e:1}
// 4) d is fetched, and isTail==true so it completes up the tree.
//    * a:1 -> {e:1}
// 5) e is fetched, decrements e and a by 1, and triggers f and g to increment
//    e an a by 2.
//    * a:2 -> {e:2 -> {f:1, g:1}}
// 6) f is fetched, and isTail==true so it completes up the tree.
//    * a:1 -> {e:1 -> {g:1}}
// 7) g is fetched, completing g, e, and a.
//    * <empty>
//
// Blocks may have multiple parents over time, since this block's current
// parent might not have finished prefetching by the time it's changed by a
// write to its subtree. That is, if we have a tree of `a` -> `b`, and a write
// causes `a` to get an additional child of `c`, then the new tree is `a` ->
// `b`, `a'` -> {`b`, `c`}. `b` now has 2 parents: `a` and `a'`, both of which
// need to be notified of the prefetch completing.
//
// A *critical* assumption here is that a block tree will never have a diamond
// topology. That is, while a block may have multiple parents, at no point can
// there exist more than one path from a block to another block in the tree.
// That assumption should hold because blocks are content addressed, so
// changing anything about one block creates brand new parents all the way up
// the tree. If this did ever happen, a completed fetch downstream of the
// diamond would be double counted in all nodes above the diamond, and the
// prefetcher would eventually panic.
func (p *blockPrefetcher) run(
	testSyncCh <-chan struct{}, testDoneCh chan<- struct{}) {
	defer func() {
		close(p.doneCh)
		p.prefetchRequestCh.Close()
		p.prefetchCancelCh.Close()
		p.prefetchCancelTlfCh.Close()
		p.prefetchRescheduleCh.Close()
		p.prefetchStatusCh.Close()
		p.inFlightFetches.Close()
	}()
	isShuttingDown := false
	var shuttingDownCh <-chan interface{}
	first := true
	for {
		if !first && testDoneCh != nil && !isShuttingDown {
			testDoneCh <- struct{}{}
		}
		first = false
		if isShuttingDown {
			if p.inFlightFetches.Len() == 0 &&
				p.prefetchRequestCh.Len() == 0 &&
				p.prefetchCancelCh.Len() == 0 &&
				p.prefetchCancelTlfCh.Len() == 0 &&
				p.prefetchRescheduleCh.Len() == 0 &&
				p.prefetchStatusCh.Len() == 0 {
				return
			}
		} else if testSyncCh != nil {
			// Only sync if we aren't shutting down.
			<-testSyncCh
		}

		p.handleCriticalRequests()

		select {
		case req := <-p.prefetchStatusCh.Out():
			p.handleStatusRequest(req.(*prefetchStatusRequest))
		case chInterface := <-shuttingDownCh:
			p.log.Debug("shutting down, clearing in flight fetches")
			ch := chInterface.(<-chan error)
			<-ch
		case ptrInt := <-p.prefetchCancelCh.Out():
			ptr := ptrInt.(data.BlockPointer)
			pre, ok := p.prefetches[ptr.ID]
			if !ok {
				p.vlog.Log(libkb.VLog2, "nothing to cancel for block %s", ptr)
				continue
			}
			p.vlog.Log(libkb.VLog2, "canceling prefetch for block %s", ptr)
			// Walk up the block tree and delete every parent, but
			// only ancestors of this given pointer with this
			// refnonce.  Other references to the same ID might still
			// be live.
			p.applyToPtrParentsRecursive(p.cancelPrefetch, ptr, pre)
		case reqInt := <-p.prefetchCancelTlfCh.Out():
			req := reqInt.(cancelTlfPrefetch)
			p.log.CDebugf(
				context.TODO(), "Canceling all prefetches for TLF %s",
				req.tlfID)
			// Cancel all prefetches for this TLF.
			for id, pre := range p.prefetches {
				if pre.req.kmd.TlfID() != req.tlfID {
					continue
				}

				p.vlog.CLogf(
					pre.ctx, libkb.VLog2, "TLF-canceling prefetch for %s",
					pre.req.ptr)
				p.doCancel(id, pre)
			}
			close(req.channel)
		case reqInt := <-p.prefetchRescheduleCh.Out():
			req := reqInt.(*prefetchRequest)
			blockID := req.ptr.ID
			pre, isPrefetchWaiting := p.prefetches[blockID]
			if !isPrefetchWaiting {
				// Create new prefetch here while rescheduling, to
				// prevent other subsequent requests from creating
				// one.
				pre = p.newPrefetch(1, uint64(req.encodedSize), false, req)
				p.prefetches[blockID] = pre
			} else {
				pre.req = req
			}
			p.vlog.CLogf(pre.ctx, libkb.VLog2,
				"rescheduling top-block prefetch for block %s", blockID)
			p.applyToParentsRecursive(p.rescheduleTopBlock, blockID, pre)
		case reqInt := <-p.prefetchRequestCh.Out():
			req := reqInt.(*prefetchRequest)
			p.handlePrefetchRequest(req)
		case <-p.almostDoneCh:
			p.log.CDebugf(p.ctx, "starting shutdown")
			isShuttingDown = true
			shuttingDownCh = p.inFlightFetches.Out()
			for id := range p.rescheduled {
				p.clearRescheduleState(id)
			}
		}
	}
}

func (p *blockPrefetcher) setObseletedOnQueuedPrefetch(req *prefetchRequest) {
	p.queuedPrefetchHandlesLock.Lock()
	defer p.queuedPrefetchHandlesLock.Unlock()
	qp, present := p.queuedPrefetchHandles[req.ptr]
	if present {
		req.obseleted = qp.channel
		qp.waitingPrefetches++
	} else {
		obseleted := make(chan struct{})
		req.obseleted = obseleted
		p.queuedPrefetchHandles[req.ptr] = queuedPrefetch{
			1, obseleted, req.kmd.TlfID()}
	}
}

func (p *blockPrefetcher) triggerPrefetch(req *prefetchRequest) {
	if req.obseleted == nil {
		p.setObseletedOnQueuedPrefetch(req)
	}
	select {
	case p.prefetchRequestCh.In() <- req:
	case <-p.shutdownCh:
		p.log.Warning("Skipping prefetch for block %v since "+
			"the prefetcher is shutdown", req.ptr.ID)
	}
}

func (p *blockPrefetcher) cacheOrCancelPrefetch(ctx context.Context,
	ptr data.BlockPointer, tlfID tlf.ID, block data.Block, lifetime data.BlockCacheLifetime,
	prefetchStatus PrefetchStatus, action BlockRequestAction,
	req *prefetchRequest) error {
	err := p.retriever.PutInCaches(
		ctx, ptr, tlfID, block, lifetime, prefetchStatus, action.CacheType())
	if err != nil {
		// The PutInCaches call can return an error if the cache is
		// full, so check for rescheduling even when err != nil.
		if doStop, doCancel := p.stopIfNeeded(ctx, req); doStop {
			if doCancel {
				p.CancelPrefetch(ptr)
			}
			return err
		}

		p.vlog.CLogf(
			ctx, libkb.VLog2, "error prefetching block %s: %+v, canceling",
			ptr.ID, err)
		p.CancelPrefetch(ptr)
	}
	return err
}

// ProcessBlockForPrefetch triggers a prefetch if appropriate.
func (p *blockPrefetcher) ProcessBlockForPrefetch(ctx context.Context,
	ptr data.BlockPointer, block data.Block, kmd libkey.KeyMetadata, priority int,
	lifetime data.BlockCacheLifetime, prefetchStatus PrefetchStatus,
	action BlockRequestAction) {
	req := &prefetchRequest{
		ptr, block.GetEncodedSize(), block.NewEmptier(), kmd, priority,
		lifetime, prefetchStatus, action, nil, nil, false}
	switch {
	case prefetchStatus == FinishedPrefetch:
		// Finished prefetches can always be short circuited.
		// If we're here, then FinishedPrefetch is already cached.
	case !action.Prefetch(block):
		// Only high priority requests can trigger prefetches. Leave the
		// prefetchStatus unchanged, but cache anyway.
		err := p.retriever.PutInCaches(
			ctx, ptr, kmd.TlfID(), block, lifetime, prefetchStatus,
			action.CacheType())
		if err != nil {
			p.log.CDebugf(ctx, "Couldn't put block %s in caches: %+v", ptr, err)
		}
	default:
		// Note that here we are caching `TriggeredPrefetch`, but the request
		// will still reflect the passed-in `prefetchStatus`, since that's the
		// one the prefetching goroutine needs to decide what to do with.
		err := p.cacheOrCancelPrefetch(
			ctx, ptr, kmd.TlfID(), block, lifetime, TriggeredPrefetch, action,
			req)
		if err != nil {
			return
		}
	}
	p.triggerPrefetch(req)
}

var errPrefetcherAlreadyShutDown = errors.New("Already shut down")

// WaitChannelForBlockPrefetch implements the Prefetcher interface for
// blockPrefetcher.
func (p *blockPrefetcher) WaitChannelForBlockPrefetch(
	ctx context.Context, ptr data.BlockPointer) (
	waitCh <-chan struct{}, err error) {
	c := make(chan (<-chan struct{}), 1)
	req := &prefetchRequest{
		ptr, 0, nil, nil, 0, data.TransientEntry, 0, BlockRequestSolo, c, nil,
		false}

	select {
	case p.prefetchRequestCh.In() <- req:
	case <-p.shutdownCh:
		return nil, errPrefetcherAlreadyShutDown
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	// Wait for response.
	select {
	case waitCh := <-c:
		return waitCh, nil
	case <-p.shutdownCh:
		return nil, errPrefetcherAlreadyShutDown
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// Status implements the Prefetcher interface for
// blockPrefetcher.
func (p *blockPrefetcher) Status(ctx context.Context, ptr data.BlockPointer) (
	PrefetchProgress, error) {
	c := make(chan PrefetchProgress, 1)
	req := &prefetchStatusRequest{ptr, c}

	select {
	case p.prefetchStatusCh.In() <- req:
	case <-p.shutdownCh:
		return PrefetchProgress{}, errPrefetcherAlreadyShutDown
	case <-ctx.Done():
		return PrefetchProgress{}, ctx.Err()
	}
	// Wait for response.
	select {
	case status := <-c:
		return status, nil
	case <-p.shutdownCh:
		return PrefetchProgress{}, errPrefetcherAlreadyShutDown
	case <-ctx.Done():
		return PrefetchProgress{}, ctx.Err()
	}
}

// OverallSyncStatus implements the Prefetcher interface for
// blockPrefetcher.
func (p *blockPrefetcher) OverallSyncStatus() PrefetchProgress {
	p.overallSyncStatusLock.RLock()
	defer p.overallSyncStatusLock.RUnlock()
	return p.overallSyncStatus
}

func (p *blockPrefetcher) CancelPrefetch(ptr data.BlockPointer) {
	p.cancelQueuedPrefetch(ptr)
	select {
	case p.prefetchCancelCh.In() <- ptr:
	case <-p.shutdownCh:
		p.log.Warning("Skipping prefetch cancel for block %v since "+
			"the prefetcher is shutdown", ptr)
	}
}

func (p *blockPrefetcher) CancelTlfPrefetches(
	ctx context.Context, tlfID tlf.ID) error {
	c := make(chan struct{})

	p.cancelQueuedPrefetchesForTlf(tlfID)
	select {
	case p.prefetchCancelTlfCh.In() <- cancelTlfPrefetch{tlfID, c}:
	case <-ctx.Done():
		return ctx.Err()
	case <-p.shutdownCh:
		p.log.Warning("Skipping prefetch cancel for TLF %s since "+
			"the prefetcher is shutdown", tlfID)
	}

	select {
	case <-c:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-p.shutdownCh:
		return errPrefetcherAlreadyShutDown
	}
}

// Shutdown implements the Prefetcher interface for blockPrefetcher.
func (p *blockPrefetcher) Shutdown() <-chan struct{} {
	p.shutdownOnce.Do(func() {
		close(p.shutdownCh)
	})
	return p.doneCh
}
