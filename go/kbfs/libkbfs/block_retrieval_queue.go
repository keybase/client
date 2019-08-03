// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"container/heap"
	"io"
	"reflect"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"

	"github.com/eapache/channels"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	defaultBlockRetrievalWorkerQueueSize int = 100
	defaultPrefetchWorkerQueueSize       int = 2
	testBlockRetrievalWorkerQueueSize    int = 5
	testPrefetchWorkerQueueSize          int = 1
	defaultOnDemandRequestPriority       int = 1 << 30
	throttleRequestPriority              int = 1 << 15

	defaultThrottledPrefetchPeriod = 1 * time.Second
)

type blockRetrievalPartialConfig interface {
	data.Versioner
	logMaker
	blockCacher
	diskBlockCacheGetter
	syncedTlfGetterSetter
	initModeGetter
	clockGetter
	reporterGetter
	settingsDBGetter
}

type blockRetrievalConfig interface {
	blockRetrievalPartialConfig
	blockGetter() blockGetter
}

type realBlockRetrievalConfig struct {
	blockRetrievalPartialConfig
	bg blockGetter
}

func (c *realBlockRetrievalConfig) blockGetter() blockGetter {
	return c.bg
}

// blockRetrievalRequest represents one consumer's request for a block.
type blockRetrievalRequest struct {
	block  data.Block
	doneCh chan error
}

// blockRetrieval contains the metadata for a given block retrieval. May
// represent many requests, all of which will be handled at once.
type blockRetrieval struct {
	//// Retrieval Metadata
	// the block pointer to retrieve
	blockPtr data.BlockPointer
	// the key metadata for the request
	kmd libkey.KeyMetadata
	// the context encapsulating all request contexts
	ctx *CoalescingContext
	// cancel function for the context
	cancelFunc context.CancelFunc

	// protects requests, cacheLifetime, the prefetch channels, and action
	reqMtx sync.RWMutex
	// the individual requests for this block pointer: they must be notified
	// once the block is returned
	requests []*blockRetrievalRequest
	// the cache lifetime for the retrieval
	cacheLifetime data.BlockCacheLifetime
	// the follow-on action to take once the block is fetched
	action BlockRequestAction

	//// Queueing Metadata
	// the index of the retrieval in the heap
	index int
	// the priority of the retrieval: larger priorities are processed first
	priority int
	// state of global request counter when this retrieval was created;
	// maintains FIFO
	insertionOrder uint64
}

// blockPtrLookup is used to uniquely identify block retrieval requests. The
// reflect.Type is needed because sometimes a request is placed concurrently
// for a specific block type and a generic block type. The requests will both
// cause a retrieval, but branching on type allows us to avoid special casing
// the code.
type blockPtrLookup struct {
	bp data.BlockPointer
	t  reflect.Type
}

// blockRetrievalQueue manages block retrieval requests. Higher priority
// requests are executed first. Requests are executed in FIFO order within a
// given priority level.
type blockRetrievalQueue struct {
	config blockRetrievalConfig
	log    logger.Logger
	vlog   *libkb.VDebugLog
	// protects ptrs, insertionCount, and the heap
	mtx sync.RWMutex
	// queued or in progress retrievals
	ptrs map[blockPtrLookup]*blockRetrieval
	// global counter of insertions to queue
	// capacity: ~584 years at 1 billion requests/sec
	insertionCount uint64
	heap           *blockRetrievalHeap

	// These are notification channels to maximize the time that each request
	// is in the heap, allowing preemption as long as possible. This way, a
	// request only exits the heap once a worker is ready.
	workerCh         channels.Channel
	prefetchWorkerCh channels.Channel
	throttledWorkCh  channels.Channel

	// slices to store the workers so we can terminate them when we're done
	workers []*blockRetrievalWorker

	// channel to be closed when we're done accepting requests
	doneLock sync.RWMutex
	doneCh   chan struct{}

	shutdownCompleteCh chan struct{}

	// protects prefetcher
	prefetchMtx sync.RWMutex
	// prefetcher for handling prefetching scenarios
	prefetcher Prefetcher

	prefetchStatusLock           sync.Mutex
	prefetchStatusForNoDiskCache *lru.Cache
}

var _ BlockRetriever = (*blockRetrievalQueue)(nil)

// newBlockRetrievalQueue creates a new block retrieval queue. The numWorkers
// parameter determines how many workers can concurrently call Work (more than
// numWorkers will block).
func newBlockRetrievalQueue(
	numWorkers int, numPrefetchWorkers int,
	throttledPrefetchPeriod time.Duration,
	config blockRetrievalConfig) *blockRetrievalQueue {
	var throttledWorkCh channels.Channel
	if numPrefetchWorkers > 0 {
		throttledWorkCh = NewInfiniteChannelWrapper()
	}

	log := config.MakeLogger("")
	q := &blockRetrievalQueue{
		config:             config,
		log:                log,
		vlog:               config.MakeVLogger(log),
		ptrs:               make(map[blockPtrLookup]*blockRetrieval),
		heap:               &blockRetrievalHeap{},
		workerCh:           NewInfiniteChannelWrapper(),
		prefetchWorkerCh:   NewInfiniteChannelWrapper(),
		throttledWorkCh:    throttledWorkCh,
		doneCh:             make(chan struct{}),
		shutdownCompleteCh: make(chan struct{}),
		workers: make([]*blockRetrievalWorker, 0,
			numWorkers+numPrefetchWorkers),
	}
	q.prefetcher = newBlockPrefetcher(q, config, nil, nil)
	for i := 0; i < numWorkers; i++ {
		q.workers = append(q.workers, newBlockRetrievalWorker(
			config.blockGetter(), q, q.workerCh))
	}
	for i := 0; i < numPrefetchWorkers; i++ {
		q.workers = append(q.workers, newBlockRetrievalWorker(
			config.blockGetter(), q, q.prefetchWorkerCh))
	}
	if numPrefetchWorkers > 0 {
		go q.throttleReleaseLoop(
			throttledPrefetchPeriod / time.Duration(numPrefetchWorkers))
	}
	return q
}

func (brq *blockRetrievalQueue) sendWork(workerCh channels.Channel) {
	select {
	case <-brq.doneCh:
		_ = brq.shutdownRetrievalLocked()
	// Notify the next queued worker.
	case workerCh.In() <- struct{}{}:
	}
}

func (brq *blockRetrievalQueue) throttleReleaseLoop(
	period time.Duration) {
	var tickerCh <-chan time.Time
	if period > 0 {
		t := time.NewTicker(period)
		defer t.Stop()
		tickerCh = t.C
	} else {
		fullTickerCh := make(chan time.Time)
		close(fullTickerCh)
		tickerCh = fullTickerCh
	}
	for {
		select {
		case <-brq.doneCh:
			return
		case <-tickerCh:
		}

		select {
		case <-brq.throttledWorkCh.Out():
			brq.mtx.Lock()
			brq.sendWork(brq.prefetchWorkerCh)
			brq.mtx.Unlock()
		case <-brq.doneCh:
			return
		}
	}
}

func (brq *blockRetrievalQueue) popIfNotEmptyLocked() *blockRetrieval {
	if brq.heap.Len() > 0 {
		return heap.Pop(brq.heap).(*blockRetrieval)
	}
	return nil
}

func (brq *blockRetrievalQueue) popIfNotEmpty() *blockRetrieval {
	brq.mtx.Lock()
	defer brq.mtx.Unlock()
	return brq.popIfNotEmptyLocked()
}

func (brq *blockRetrievalQueue) shutdownRetrievalLocked() bool {
	retrieval := brq.popIfNotEmptyLocked()
	if retrieval == nil {
		return false
	}

	// TODO: try to infer the block type from the requests in the retrieval?
	bpLookup := blockPtrLookup{retrieval.blockPtr, reflect.TypeOf(nil)}
	delete(brq.ptrs, bpLookup)
	brq.finalizeRequestAfterPtrDeletion(
		retrieval, nil, DiskBlockAnyCache, io.EOF)
	return true
}

// notifyWorker notifies workers that there is a new request for processing.
func (brq *blockRetrievalQueue) notifyWorker(priority int) {
	// On-demand workers and prefetch workers share the priority queue. This
	// allows maximum time for requests to jump the queue, at least until the
	// worker actually begins working on it.
	//
	// Note that the worker being notified won't necessarily work on the exact
	// request that caused the notification. It's just a counter. That means
	// that sometimes on-demand workers will work on prefetch requests, and
	// vice versa. But the numbers should match.
	//
	// However, there are some pathological scenarios where if all the workers
	// of one type are making progress but the other type are not (which is
	// highly improbable), requests of one type could starve the other. By
	// design, on-demand requests _should_ starve prefetch requests, so this is
	// a problem only if prefetch requests can starve on-demand workers. But
	// because there are far more on-demand workers than prefetch workers, this
	// should never actually happen.
	workerCh := brq.workerCh
	if priority <= throttleRequestPriority && brq.throttledWorkCh != nil {
		workerCh = brq.throttledWorkCh
	} else if priority < defaultOnDemandRequestPriority {
		workerCh = brq.prefetchWorkerCh
	}
	brq.sendWork(workerCh)
}

func (brq *blockRetrievalQueue) initPrefetchStatusCacheLocked() error {
	if !brq.config.IsTestMode() && brq.config.Mode().Type() != InitSingleOp {
		// If the disk block cache directory can't be accessed due to
		// permission errors (happens sometimes on iOS for some
		// reason), we might need to rely on this in-memory map.
		brq.log.Warning("No disk block cache is initialized when not testing")
	}
	brq.log.CDebugf(context.TODO(), "Using a local cache for prefetch status")
	var err error
	cache, err := lru.New(10000)
	if err == nil {
		brq.prefetchStatusForNoDiskCache = cache
	}
	return err
}

func (brq *blockRetrievalQueue) getPrefetchStatus(
	id kbfsblock.ID) (PrefetchStatus, error) {
	brq.prefetchStatusLock.Lock()
	defer brq.prefetchStatusLock.Unlock()
	if brq.prefetchStatusForNoDiskCache == nil {
		err := brq.initPrefetchStatusCacheLocked()
		if err != nil {
			return NoPrefetch, err
		}
	}
	status, ok := brq.prefetchStatusForNoDiskCache.Get(id)
	if !ok {
		return NoPrefetch, nil
	}
	return status.(PrefetchStatus), nil
}

func (brq *blockRetrievalQueue) setPrefetchStatus(
	id kbfsblock.ID, prefetchStatus PrefetchStatus) error {
	brq.prefetchStatusLock.Lock()
	defer brq.prefetchStatusLock.Unlock()
	if brq.prefetchStatusForNoDiskCache == nil {
		err := brq.initPrefetchStatusCacheLocked()
		if err != nil {
			return err
		}
	}
	if brq.prefetchStatusForNoDiskCache == nil {
		panic("nil???")
	}
	status, ok := brq.prefetchStatusForNoDiskCache.Get(id)
	if !ok || prefetchStatus > status.(PrefetchStatus) {
		brq.prefetchStatusForNoDiskCache.Add(id, prefetchStatus)
	}
	return nil
}

// PutInCaches implements the BlockRetriever interface for
// BlockRetrievalQueue.
func (brq *blockRetrievalQueue) PutInCaches(ctx context.Context,
	ptr data.BlockPointer, tlfID tlf.ID, block data.Block, lifetime data.BlockCacheLifetime,
	prefetchStatus PrefetchStatus, cacheType DiskBlockCacheType) (err error) {
	// TODO: plumb through whether journaling is enabled for this TLF,
	// to set the right cache behavior.
	err = brq.config.BlockCache().Put(
		ptr, tlfID, block, lifetime, data.DoCacheHash)
	switch err.(type) {
	case nil:
	case data.CachePutCacheFullError:
		// Ignore cache full errors and send to the disk cache anyway.
	default:
		return err
	}
	dbc := brq.config.DiskBlockCache()
	if dbc == nil {
		return brq.setPrefetchStatus(ptr.ID, prefetchStatus)
	}
	err = dbc.UpdateMetadata(ctx, tlfID, ptr.ID, prefetchStatus, cacheType)
	switch errors.Cause(err).(type) {
	case nil:
	case data.NoSuchBlockError:
		// TODO: Add the block to the DBC. This is complicated because we
		// need the serverHalf.
		brq.vlog.CLogf(ctx, libkb.VLog2,
			"Block %s missing for disk block cache metadata update", ptr.ID)
	default:
		brq.vlog.CLogf(ctx, libkb.VLog2, "Error updating metadata: %+v", err)
	}
	// All disk cache errors are fatal
	return err
}

// checkCaches copies a block into `block` if it's in one of our caches.
func (brq *blockRetrievalQueue) checkCaches(ctx context.Context,
	kmd libkey.KeyMetadata, ptr data.BlockPointer, block data.Block,
	action BlockRequestAction) (PrefetchStatus, error) {
	dbc := brq.config.DiskBlockCache()
	preferredCacheType := action.CacheType()

	cachedBlock, err := brq.config.BlockCache().Get(ptr)
	if err == nil {
		if dbc == nil {
			block.Set(cachedBlock)
			return brq.getPrefetchStatus(ptr.ID)
		}

		prefetchStatus, err := dbc.GetPrefetchStatus(
			ctx, kmd.TlfID(), ptr.ID, preferredCacheType)
		if err == nil {
			block.Set(cachedBlock)
			return prefetchStatus, nil
		}
		// If the prefetch status wasn't in the preferred cache, do a
		// full `Get()` below in an attempt to move the full block
		// into the preferred cache.
	} else if dbc == nil || action.DelayCacheCheck() {
		return NoPrefetch, err
	}

	blockBuf, serverHalf, prefetchStatus, err := dbc.Get(
		ctx, kmd.TlfID(), ptr.ID, preferredCacheType)
	if err != nil {
		return NoPrefetch, err
	}
	if len(blockBuf) == 0 {
		return NoPrefetch, data.NoSuchBlockError{ID: ptr.ID}
	}

	// Assemble the block from the encrypted block buffer.
	err = brq.config.blockGetter().assembleBlock(ctx, kmd, ptr, block, blockBuf,
		serverHalf)
	if err == nil {
		// Cache the block in memory.  TODO: plumb through whether
		// journaling is enabled for this TLF, to set the right cache
		// behavior.
		_ = brq.config.BlockCache().Put(
			ptr, kmd.TlfID(), block, data.TransientEntry, data.DoCacheHash)
	}
	return prefetchStatus, err
}

// request retrieves blocks asynchronously.
func (brq *blockRetrievalQueue) request(ctx context.Context,
	priority int, kmd libkey.KeyMetadata, ptr data.BlockPointer, block data.Block,
	lifetime data.BlockCacheLifetime, action BlockRequestAction) <-chan error {
	brq.vlog.CLogf(ctx, libkb.VLog2,
		"Request of %v, action=%s, priority=%d", ptr, action, priority)

	// Only continue if we haven't been shut down
	brq.doneLock.RLock()
	defer brq.doneLock.RUnlock()

	ch := make(chan error, 1)
	select {
	case <-brq.doneCh:
		ch <- io.EOF
		if action.PrefetchTracked() {
			brq.Prefetcher().CancelPrefetch(ptr)
		}
		return ch
	default:
	}
	if block == nil {
		ch <- errors.New("nil block passed to blockRetrievalQueue.Request")
		if action.PrefetchTracked() {
			brq.Prefetcher().CancelPrefetch(ptr)
		}
		return ch
	}

	// Check caches before locking the mutex.
	prefetchStatus, err := brq.checkCaches(ctx, kmd, ptr, block, action)
	if err == nil {
		if action != BlockRequestSolo {
			brq.vlog.CLogf(
				ctx, libkb.VLog2, "Found %v in caches: %s", ptr, prefetchStatus)
		}
		if action.PrefetchTracked() {
			brq.Prefetcher().ProcessBlockForPrefetch(ctx, ptr, block, kmd,
				priority, lifetime, prefetchStatus, action)
		}
		ch <- nil
		return ch
	}
	err = checkDataVersion(brq.config, data.Path{}, ptr)
	if err != nil {
		if action.PrefetchTracked() {
			brq.Prefetcher().CancelPrefetch(ptr)
		}
		ch <- err
		return ch
	}

	bpLookup := blockPtrLookup{ptr, reflect.TypeOf(block)}

	brq.mtx.Lock()
	defer brq.mtx.Unlock()
	// We might have to retry if the context has been canceled.  This loop will
	// iterate a maximum of 2 times. It either hits the `break` statement at
	// the bottom on the first iteration, or the `continue` statement first
	// which causes it to `break` on the next iteration.
	var br *blockRetrieval
	for {
		var exists bool
		br, exists = brq.ptrs[bpLookup]
		if !exists {
			// Add to the heap
			br = &blockRetrieval{
				blockPtr:       ptr,
				kmd:            kmd,
				index:          -1,
				priority:       priority,
				insertionOrder: brq.insertionCount,
				cacheLifetime:  lifetime,
				action:         action,
			}
			br.ctx, br.cancelFunc = NewCoalescingContext(ctx)
			brq.insertionCount++
			brq.ptrs[bpLookup] = br
			heap.Push(brq.heap, br)
			brq.notifyWorker(priority)
		} else {
			err := br.ctx.AddContext(ctx)
			if err == context.Canceled {
				// We need to delete the request pointer, but we'll still let
				// the existing request be processed by a worker.
				delete(brq.ptrs, bpLookup)
				continue
			}
		}
		break
	}
	if br.index == -1 {
		// Log newly-scheduled requests via the normal logger, so we
		// can understand why the bserver fetches certain blocks, and
		// be able to time the request from start to finish.
		brq.log.CDebugf(ctx,
			"Scheduling request of %v, action=%s, priority=%d",
			ptr, action, priority)
	}
	br.reqMtx.Lock()
	defer br.reqMtx.Unlock()
	br.requests = append(br.requests, &blockRetrievalRequest{
		block:  block,
		doneCh: ch,
	})
	if lifetime > br.cacheLifetime {
		br.cacheLifetime = lifetime
	}
	oldPriority := br.priority
	if priority > oldPriority {
		br.priority = priority
		// If the new request priority is higher, elevate the retrieval in the
		// queue.  Skip this if the request is no longer in the queue (which
		// means it's actively being processed).
		if br.index != -1 {
			heap.Fix(brq.heap, br.index)
			if (oldPriority < defaultOnDemandRequestPriority &&
				priority >= defaultOnDemandRequestPriority) ||
				(oldPriority <= throttleRequestPriority &&
					priority > throttleRequestPriority) {
				// We've crossed the priority threshold for a given
				// worker type, so we now need a worker for the new
				// priority level to pick up the request.  This means
				// that we might have up to two workers "activated"
				// per request. However, they won't leak because if a
				// worker sees an empty queue, it continues merrily
				// along.
				brq.notifyWorker(priority)
			}
		}
	}
	// Update the action if needed.
	brq.vlog.CLogf(
		ctx, libkb.VLog2, "Combining actions %s and %s", action, br.action)
	br.action = action.Combine(br.action)
	brq.vlog.CLogf(ctx, libkb.VLog2, "Got action %s", br.action)
	return ch
}

// Request implements the BlockRetriever interface for blockRetrievalQueue.
func (brq *blockRetrievalQueue) Request(ctx context.Context,
	priority int, kmd libkey.KeyMetadata, ptr data.BlockPointer, block data.Block,
	lifetime data.BlockCacheLifetime, action BlockRequestAction) <-chan error {
	if brq.config.IsSyncedTlf(kmd.TlfID()) {
		action = action.AddSync()
	}
	return brq.request(ctx, priority, kmd, ptr, block, lifetime, action)
}

func (brq *blockRetrievalQueue) finalizeRequestAfterPtrDeletion(
	retrieval *blockRetrieval, block data.Block, cacheType DiskBlockCacheType,
	retrievalErr error) {
	defer retrieval.cancelFunc()

	// This is a lock that exists for the race detector, since there
	// shouldn't be any other goroutines accessing the retrieval at this
	// point. In `Request`, the requests slice can be modified while locked
	// by `brq.mtx`. But once we delete `bpLookup` from `brq.ptrs` here
	// (while locked by `brq.mtx`), there is no longer a way for anyone else
	// to write `retrieval.requests`. However, the race detector still
	// notices that we're reading `retrieval.requests` without a lock, where
	// it was written by a different goroutine in `Request`. So, we lock it
	// with its own mutex in both places.
	retrieval.reqMtx.RLock()
	defer retrieval.reqMtx.RUnlock()

	dbc := brq.config.DiskBlockCache()
	if dbc != nil && cacheType != retrieval.action.CacheType() {
		brq.log.CDebugf(retrieval.ctx,
			"Cache type changed from %s to %s since we made the request for %s",
			cacheType, retrieval.action.CacheType(),
			retrieval.blockPtr)
		_, _, _, err := dbc.Get(
			retrieval.ctx, retrieval.kmd.TlfID(), retrieval.blockPtr.ID,
			retrieval.action.CacheType())
		if err != nil {
			brq.log.CDebugf(retrieval.ctx,
				"Couldn't move block to preferred cache: %+v", err)
		}
	}

	// Cache the block and trigger prefetches if there is no error.
	if retrieval.action.PrefetchTracked() {
		if retrievalErr == nil {
			// We treat this request as not having been prefetched, because the
			// only way to get here is if the request wasn't already cached.
			// Need to call with context.Background() because the retrieval's
			// context will be canceled as soon as this method returns.
			brq.Prefetcher().ProcessBlockForPrefetch(context.Background(),
				retrieval.blockPtr, block, retrieval.kmd, retrieval.priority,
				retrieval.cacheLifetime, NoPrefetch, retrieval.action)
		} else {
			brq.log.CDebugf(
				retrieval.ctx, "Couldn't get block %s: %+v", retrieval.blockPtr, retrievalErr)
			brq.Prefetcher().CancelPrefetch(retrieval.blockPtr)
		}
	} else if retrievalErr == nil {
		// Even if the block is not being tracked by the prefetcher,
		// we still want to put it in the block caches.
		err := brq.PutInCaches(
			retrieval.ctx, retrieval.blockPtr, retrieval.kmd.TlfID(), block,
			retrieval.cacheLifetime, NoPrefetch, retrieval.action.CacheType())
		if err != nil {
			brq.log.CDebugf(
				retrieval.ctx, "Couldn't put block in cache: %+v", err)
			// swallow the error if we were unable to put the block into caches.
		}
	}

	for _, r := range retrieval.requests {
		req := r
		if block != nil {
			// Copy the decrypted block to the caller
			req.block.Set(block)
		}
		// Since we created this channel with a buffer size of 1, this won't
		// block.
		req.doneCh <- retrievalErr
	}
	// Clearing references to the requested blocks seems to plug a
	// leak, but not sure why yet.
	// TODO: strib fixed this earlier. Should be safe to remove here, but
	// follow up in PR.
	retrieval.requests = nil
}

// FinalizeRequest is the last step of a retrieval request once a block has
// been obtained. It removes the request from the blockRetrievalQueue,
// preventing more requests from mutating the retrieval, then notifies all
// subscribed requests.
func (brq *blockRetrievalQueue) FinalizeRequest(
	retrieval *blockRetrieval, block data.Block, cacheType DiskBlockCacheType,
	retrievalErr error) {
	brq.mtx.Lock()
	// This might have already been removed if the context has been canceled.
	// That's okay, because this will then be a no-op.
	bpLookup := blockPtrLookup{retrieval.blockPtr, reflect.TypeOf(block)}
	delete(brq.ptrs, bpLookup)
	brq.mtx.Unlock()
	brq.finalizeRequestAfterPtrDeletion(
		retrieval, block, cacheType, retrievalErr)
}

func channelToWaitGroup(wg *sync.WaitGroup, ch <-chan struct{}) {
	wg.Add(1)
	go func() {
		<-ch
		wg.Done()
	}()
}

func (brq *blockRetrievalQueue) finalizeAllRequests() {
	brq.mtx.Lock()
	defer brq.mtx.Unlock()
	for brq.shutdownRetrievalLocked() {
	}
}

// Shutdown is called when we are no longer accepting requests.
func (brq *blockRetrievalQueue) Shutdown() <-chan struct{} {
	brq.doneLock.Lock()
	defer brq.doneLock.Unlock()

	select {
	case <-brq.doneCh:
		return brq.shutdownCompleteCh
	default:
	}

	var shutdownWaitGroup sync.WaitGroup
	// We close `doneCh` first so that new requests coming in get
	// finalized immediately rather than racing with dying workers.
	close(brq.doneCh)
	for _, w := range brq.workers {
		channelToWaitGroup(&shutdownWaitGroup, w.Shutdown())
	}
	brq.finalizeAllRequests()

	brq.prefetchMtx.Lock()
	defer brq.prefetchMtx.Unlock()
	channelToWaitGroup(&shutdownWaitGroup, brq.prefetcher.Shutdown())

	brq.workerCh.Close()
	brq.prefetchWorkerCh.Close()
	if brq.throttledWorkCh != nil {
		brq.throttledWorkCh.Close()
	}

	go func() {
		shutdownWaitGroup.Wait()
		close(brq.shutdownCompleteCh)
	}()
	return brq.shutdownCompleteCh
}

// TogglePrefetcher allows upstream components to turn the prefetcher on or
// off. If an error is returned due to a context cancelation, the prefetcher is
// never re-enabled.
func (brq *blockRetrievalQueue) TogglePrefetcher(enable bool,
	testSyncCh <-chan struct{}, testDoneCh chan<- struct{}) <-chan struct{} {
	// We must hold this lock for the whole function so that multiple calls to
	// this function doesn't leak prefetchers.
	brq.prefetchMtx.Lock()
	defer brq.prefetchMtx.Unlock()
	// Allow the caller to block on the current shutdown.
	ch := brq.prefetcher.Shutdown()
	if enable {
		brq.prefetcher = newBlockPrefetcher(
			brq, brq.config, testSyncCh, testDoneCh)
	}
	return ch
}

// Prefetcher allows us to retrieve the prefetcher.
func (brq *blockRetrievalQueue) Prefetcher() Prefetcher {
	brq.prefetchMtx.RLock()
	defer brq.prefetchMtx.RUnlock()
	return brq.prefetcher
}
