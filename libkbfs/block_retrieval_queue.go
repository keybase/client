// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"container/heap"
	"io"
	"reflect"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	defaultBlockRetrievalWorkerQueueSize int = 100
	defaultPrefetchWorkerQueueSize       int = 2
	minimalBlockRetrievalWorkerQueueSize int = 2
	minimalPrefetchWorkerQueueSize       int = 1
	testBlockRetrievalWorkerQueueSize    int = 5
	testPrefetchWorkerQueueSize          int = 1
	defaultOnDemandRequestPriority       int = 1 << 30
	lowestTriggerPrefetchPriority        int = 1
	// Channel buffer size can be big because we use the empty struct.
	workerQueueSize int = 1<<31 - 1
)

type blockRetrievalPartialConfig interface {
	dataVersioner
	logMaker
	blockCacher
	diskBlockCacheGetter
	syncedTlfGetterSetter
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
	block  Block
	doneCh chan error
}

// blockRetrieval contains the metadata for a given block retrieval. May
// represent many requests, all of which will be handled at once.
type blockRetrieval struct {
	//// Retrieval Metadata
	// the block pointer to retrieve
	blockPtr BlockPointer
	// the key metadata for the request
	kmd KeyMetadata
	// the context encapsulating all request contexts
	ctx *CoalescingContext
	// cancel function for the context
	cancelFunc context.CancelFunc

	// protects requests, cacheLifetime, and the prefetch channels
	reqMtx sync.RWMutex
	// the individual requests for this block pointer: they must be notified
	// once the block is returned
	requests []*blockRetrievalRequest
	// the cache lifetime for the retrieval
	cacheLifetime BlockCacheLifetime
	// channel to notify when this retrieval and its entire subtree is done
	// prefetching
	prefetchDoneCh chan<- struct{}
	// channel to notify when a prefetch in the subtree for this retrieval
	// fails for any reason
	prefetchErrCh chan<- struct{}

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
	bp BlockPointer
	t  reflect.Type
}

// blockRetrievalQueue manages block retrieval requests. Higher priority
// requests are executed first. Requests are executed in FIFO order within a
// given priority level.
type blockRetrievalQueue struct {
	config blockRetrievalConfig
	log    logger.Logger
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
	workerCh         chan<- struct{}
	prefetchWorkerCh chan<- struct{}
	// slices to store the workers so we can terminate them when we're done
	workers []*blockRetrievalWorker
	// channel to be closed when we're done accepting requests
	doneCh chan struct{}

	// protects prefetcher
	prefetchMtx sync.RWMutex
	// prefetcher for handling prefetching scenarios
	prefetcher Prefetcher
}

var _ BlockRetriever = (*blockRetrievalQueue)(nil)

// newBlockRetrievalQueue creates a new block retrieval queue. The numWorkers
// parameter determines how many workers can concurrently call Work (more than
// numWorkers will block).
func newBlockRetrievalQueue(numWorkers int, numPrefetchWorkers int,
	config blockRetrievalConfig) *blockRetrievalQueue {
	workerCh := make(chan struct{}, workerQueueSize)
	prefetchWorkerCh := make(chan struct{}, workerQueueSize)
	q := &blockRetrievalQueue{
		config:           config,
		log:              config.MakeLogger(""),
		ptrs:             make(map[blockPtrLookup]*blockRetrieval),
		heap:             &blockRetrievalHeap{},
		workerCh:         workerCh,
		prefetchWorkerCh: prefetchWorkerCh,
		doneCh:           make(chan struct{}),
		workers: make([]*blockRetrievalWorker, 0,
			numWorkers+numPrefetchWorkers),
	}
	q.prefetcher = newBlockPrefetcher(q, config)
	for i := 0; i < numWorkers; i++ {
		q.workers = append(q.workers, newBlockRetrievalWorker(
			config.blockGetter(), q, workerCh))
	}
	for i := 0; i < numPrefetchWorkers; i++ {
		q.workers = append(q.workers, newBlockRetrievalWorker(
			config.blockGetter(), q, prefetchWorkerCh))
	}
	return q
}

func (brq *blockRetrievalQueue) popIfNotEmpty() *blockRetrieval {
	brq.mtx.Lock()
	defer brq.mtx.Unlock()
	if brq.heap.Len() > 0 {
		return heap.Pop(brq.heap).(*blockRetrieval)
	}
	return nil
}

func (brq *blockRetrievalQueue) shutdownRetrieval() {
	retrieval := brq.popIfNotEmpty()
	if retrieval != nil {
		brq.FinalizeRequest(retrieval, nil, io.EOF)
	}
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
	if priority < defaultOnDemandRequestPriority {
		workerCh = brq.prefetchWorkerCh
	}
	select {
	case <-brq.doneCh:
		brq.shutdownRetrieval()
	// Notify the next queued worker.
	case workerCh <- struct{}{}:
	default:
		panic("notifyWorker() would have blocked, which means we somehow " +
			"have around MaxInt32 requests already waiting.")
	}
}

func (brq *blockRetrievalQueue) triggerAndMonitorPrefetch(ctx context.Context,
	ptr BlockPointer, block Block, kmd KeyMetadata, prefetchDoneCh,
	prefetchErrCh chan<- struct{}, didUpdateCh <-chan struct{}) {
	prefetcher := brq.Prefetcher()
	childPrefetchDoneCh, childPrefetchErrCh, numBlocks :=
		prefetcher.PrefetchAfterBlockRetrieved(block, ptr, kmd)

	// If we have child blocks to prefetch, wait for them.
	if numBlocks > 0 {
		for i := 0; i < numBlocks; i++ {
			select {
			case <-childPrefetchDoneCh:
				// We expect to receive from this channel `numBlocks` times,
				// after which we know the subtree of this block is done
				// prefetching.
				continue
			case <-childPrefetchErrCh:
				// One error means this block didn't finish prefetching.
				prefetchErrCh <- struct{}{}
				return
			case <-prefetcher.ShutdownCh():
				prefetchErrCh <- struct{}{}
				return
			}
		}
	}

	// Make sure we've already updated the metadata once to avoid a race.
	<-didUpdateCh
	// Prefetches are done. Update the disk cache metadata.
	dbc := brq.config.DiskBlockCache()
	if dbc != nil {
		triggeredPrefetch := true
		finishedPrefetch := true
		err := dbc.UpdateMetadata(ctx, ptr.ID, &triggeredPrefetch,
			&finishedPrefetch)
		if err != nil {
			brq.log.CWarningf(ctx, "Error updating metadata after "+
				"prefetch: %+v", err)
		}
	}
	// Now prefetching is actually done.
	prefetchDoneCh <- struct{}{}
}

// CacheAndPrefetch implements the BlockRetrieval interface for
// blockRetrievalQueue. It also updates the LRU time for the block in the disk
// cache.
// `prefetchDoneCh` and `prefetchErrCh` can be nil so the caller doesn't always
// have to instantiate a channel if it doesn't care about waiting for the
// prefetch to complete. In this case, the `blockRetrievalQueue` instantiates
// each channel to monitor the prefetches.
func (brq *blockRetrievalQueue) CacheAndPrefetch(ctx context.Context,
	ptr BlockPointer, block Block, kmd KeyMetadata, priority int,
	lifetime BlockCacheLifetime, triggeredPrefetch bool,
	prefetchDoneCh, prefetchErrCh chan<- struct{}) (err error) {
	// Avoid having to check for nil channels below this point.
	if prefetchDoneCh == nil {
		prefetchDoneCh = make(chan struct{}, 1)
	}
	if prefetchErrCh == nil {
		prefetchErrCh = make(chan struct{}, 1)
	}
	didUpdateCh := make(chan struct{})
	defer func() {
		if err != nil {
			brq.log.CWarningf(ctx, "Error Putting into the block cache: %+v",
				err)
		}
		dbc := brq.config.DiskBlockCache()
		if dbc != nil {
			go func() {
				// Leave FinishedPrefetch unchanged at this point.
				err := dbc.UpdateMetadata(ctx, ptr.ID, &triggeredPrefetch, nil)
				close(didUpdateCh)
				switch err.(type) {
				case nil:
				case NoSuchBlockError:
				default:
					brq.log.CWarningf(ctx, "Error updating metadata: %+v", err)
				}
			}()
		} else {
			close(didUpdateCh)
		}
	}()
	// TODO: If the working set cache has triggered a prefetch in the past, and
	// we've switched to a sync cache, we still need to re-trigger prefetches
	// so that it goes down the tree.
	// In that case, this `if` should check for `finishedPrefetch` instead.
	if triggeredPrefetch {
		prefetchErrCh <- struct{}{}
		return brq.config.BlockCache().PutWithPrefetch(ptr, kmd.TlfID(), block,
			lifetime, triggeredPrefetch)
	}
	if priority < lowestTriggerPrefetchPriority {
		// Only high priority requests can trigger prefetches.
		// `triggeredPrefetch` is already false since it failed the above test.
		prefetchErrCh <- struct{}{}
		return brq.config.BlockCache().PutWithPrefetch(ptr, kmd.TlfID(), block,
			lifetime, triggeredPrefetch)
	}
	// To prevent any other Gets from prefetching, we must let the cache know
	// at this point that we've prefetched.
	triggeredPrefetch = true
	err = brq.config.BlockCache().PutWithPrefetch(ptr, kmd.TlfID(), block,
		lifetime, triggeredPrefetch)
	switch err.(type) {
	case nil:
	case cachePutCacheFullError:
		// TODO: make sure this doesn't thrash.
		brq.log.CWarningf(ctx, "In-memory block cache is full, but "+
			"prefetching anyway to populate the disk cache.")
	default:
		// We should return the error here because otherwise we could thrash
		// the prefetcher.
		prefetchErrCh <- struct{}{}
		return err
	}
	// This must be called in a goroutine to prevent deadlock in case this
	// CacheAndPrefetch call was triggered by the prefetcher itself.
	go brq.triggerAndMonitorPrefetch(ctx, ptr, block, kmd, prefetchDoneCh,
		prefetchErrCh, didUpdateCh)
	return nil
}

func (brq *blockRetrievalQueue) checkCaches(ctx context.Context,
	priority int, kmd KeyMetadata, ptr BlockPointer, block Block,
	lifetime BlockCacheLifetime,
	prefetchDoneCh, prefetchErrCh chan<- struct{}) error {
	// Attempt to retrieve the block from the cache. This might be a specific
	// type where the request blocks are CommonBlocks, but that direction can
	// Set correctly. The cache will never have CommonBlocks.
	// TODO: verify that the returned lifetime here matches `lifetime` (which
	// should always be TransientEntry, since a PermanentEntry would have been
	// served directly from the cache elsewhere)?
	cachedBlock, triggeredPrefetch, _, err :=
		brq.config.BlockCache().GetWithPrefetch(ptr)
	if err == nil && cachedBlock != nil {
		block.Set(cachedBlock)
		return brq.CacheAndPrefetch(ctx, ptr, cachedBlock, kmd, priority,
			lifetime, triggeredPrefetch, prefetchDoneCh, prefetchErrCh)
	}

	// Check the disk cache.
	dbc := brq.config.DiskBlockCache()
	if dbc == nil {
		return NoSuchBlockError{ptr.ID}
	}
	blockBuf, serverHalf, triggeredPrefetch, err := dbc.Get(ctx, kmd.TlfID(),
		ptr.ID)
	if err != nil {
		return err
	}
	if len(blockBuf) == 0 {
		return NoSuchBlockError{ptr.ID}
	}

	// Assemble the block from the encrypted block buffer.
	err = brq.config.blockGetter().assembleBlock(ctx, kmd, ptr, block,
		blockBuf, serverHalf)
	if err != nil {
		return err
	}

	return brq.CacheAndPrefetch(ctx, ptr, block, kmd, priority, lifetime,
		triggeredPrefetch, prefetchDoneCh, prefetchErrCh)
}

// RequestWithPrefetch implements the BlockRetriever interface for
// blockRetrievalQueue.
func (brq *blockRetrievalQueue) RequestWithPrefetch(ctx context.Context,
	priority int, kmd KeyMetadata, ptr BlockPointer, block Block,
	lifetime BlockCacheLifetime,
	prefetchDoneCh, prefetchErrCh chan<- struct{}) <-chan error {
	// Only continue if we haven't been shut down
	ch := make(chan error, 1)
	select {
	case <-brq.doneCh:
		ch <- io.EOF
		if prefetchErrCh != nil {
			prefetchErrCh <- struct{}{}
		}
		return ch
	default:
	}
	if block == nil {
		ch <- errors.New("nil block passed to blockRetrievalQueue.Request")
		if prefetchErrCh != nil {
			prefetchErrCh <- struct{}{}
		}
		return ch
	}

	// Check caches before locking the mutex.
	err := brq.checkCaches(ctx, priority, kmd, ptr, block, lifetime,
		prefetchDoneCh, prefetchErrCh)
	if err == nil {
		ch <- nil
		return ch
	}

	bpLookup := blockPtrLookup{ptr, reflect.TypeOf(block)}

	brq.mtx.Lock()
	defer brq.mtx.Unlock()
	// We might have to retry if the context has been canceled.  This loop will
	// iterate a maximum of 2 times. It either hits the `return` statement at
	// the bottom on the first iteration, or the `continue` statement first
	// which causes it to `return` on the next iteration.
	for {
		br, exists := brq.ptrs[bpLookup]
		if !exists {
			// Add to the heap
			br = &blockRetrieval{
				blockPtr:       ptr,
				kmd:            kmd,
				index:          -1,
				priority:       priority,
				insertionOrder: brq.insertionCount,
				cacheLifetime:  lifetime,
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
		br.reqMtx.Lock()
		br.requests = append(br.requests, &blockRetrievalRequest{
			block:  block,
			doneCh: ch,
		})
		if lifetime > br.cacheLifetime {
			br.cacheLifetime = lifetime
		}
		if br.prefetchDoneCh != nil {
			// We already have a goroutine waiting for a prefetch.
			prefetchErrCh <- struct{}{}
		} else {
			// We can set the prefetch channels for this retrieval.
			br.prefetchDoneCh = prefetchDoneCh
			br.prefetchErrCh = prefetchErrCh
		}
		br.reqMtx.Unlock()
		// If the new request priority is higher, elevate the retrieval in the
		// queue.  Skip this if the request is no longer in the queue (which
		// means it's actively being processed).
		oldPriority := br.priority
		if br.index != -1 && priority > oldPriority {
			br.priority = priority
			heap.Fix(brq.heap, br.index)
			if oldPriority < defaultOnDemandRequestPriority &&
				priority >= defaultOnDemandRequestPriority {
				// We've crossed the priority threshold for prefetch workers,
				// so we now need an on-demand worker to pick up the request.
				// This means that we might have up to two workers "activated"
				// per request. However, they won't leak because if a worker
				// sees an empty queue, it continues merrily along.
				brq.notifyWorker(priority)
			}
		}
		return ch
	}
}

// Request implements the BlockRetriever interface for blockRetrievalQueue.
func (brq *blockRetrievalQueue) Request(ctx context.Context,
	priority int, kmd KeyMetadata, ptr BlockPointer, block Block,
	lifetime BlockCacheLifetime) <-chan error {
	return brq.RequestWithPrefetch(ctx, priority, kmd, ptr, block, lifetime,
		make(chan struct{}, 1), make(chan struct{}, 1))
}

// FinalizeRequest is the last step of a retrieval request once a block has
// been obtained. It removes the request from the blockRetrievalQueue,
// preventing more requests from mutating the retrieval, then notifies all
// subscribed requests.
func (brq *blockRetrievalQueue) FinalizeRequest(
	retrieval *blockRetrieval, block Block, err error) {
	brq.mtx.Lock()
	// This might have already been removed if the context has been canceled.
	// That's okay, because this will then be a no-op.
	bpLookup := blockPtrLookup{retrieval.blockPtr, reflect.TypeOf(block)}
	delete(brq.ptrs, bpLookup)
	brq.mtx.Unlock()
	defer retrieval.cancelFunc()

	// This is a symbolic lock, since there shouldn't be any other goroutines
	// accessing requests at this point. But requests had contentious access
	// earlier, so we'll lock it here as well to maintain the integrity of the
	// lock.
	retrieval.reqMtx.Lock()
	defer retrieval.reqMtx.Unlock()

	// Cache the block and trigger prefetches if there is no error.
	if err == nil {
		// We treat this request as not having been prefetched, because the
		// only way to get here is if the request wasn't already cached.
		// Need to call with context.Background() because the retrieval's
		// context will be canceled as soon as this method returns.
		brq.CacheAndPrefetch(context.Background(), retrieval.blockPtr, block,
			retrieval.kmd, retrieval.priority, retrieval.cacheLifetime, false,
			retrieval.prefetchDoneCh, retrieval.prefetchErrCh)
	}

	for _, r := range retrieval.requests {
		req := r
		if block != nil {
			// Copy the decrypted block to the caller
			req.block.Set(block)
		}
		// Since we created this channel with a buffer size of 1, this won't
		// block.
		req.doneCh <- err
	}
}

// Shutdown is called when we are no longer accepting requests.
func (brq *blockRetrievalQueue) Shutdown() {
	select {
	case <-brq.doneCh:
	default:
		// We close `doneCh` first so that new requests coming in get finalized
		// immediately rather than racing with dying workers.
		close(brq.doneCh)
		for _, w := range brq.workers {
			w.Shutdown()
		}
		brq.prefetchMtx.Lock()
		defer brq.prefetchMtx.Unlock()
		brq.prefetcher.Shutdown()
	}
}

// TogglePrefetcher allows upstream components to turn the prefetcher on or
// off. If an error is returned due to a context cancelation, the prefetcher is
// never re-enabled.
func (brq *blockRetrievalQueue) TogglePrefetcher(ctx context.Context,
	enable bool) (err error) {
	// We must hold this lock for the whole function so that multiple calls to
	// this function doesn't leak prefetchers.
	brq.prefetchMtx.Lock()
	defer brq.prefetchMtx.Unlock()
	// Don't wait for the existing prefetcher to shutdown so we don't deadlock
	// any callers.
	_ = brq.prefetcher.Shutdown()
	if enable {
		brq.prefetcher = newBlockPrefetcher(brq, brq.config)
	}
	return nil
}

// Prefetcher allows us to retrieve the prefetcher.
func (brq *blockRetrievalQueue) Prefetcher() Prefetcher {
	brq.prefetchMtx.RLock()
	defer brq.prefetchMtx.RUnlock()
	return brq.prefetcher
}
