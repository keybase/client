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
	minimalBlockRetrievalWorkerQueueSize int = 2
	testBlockRetrievalWorkerQueueSize    int = 5
	defaultOnDemandRequestPriority       int = 100
)

type blockRetrievalPartialConfig interface {
	dataVersioner
	logMaker
	blockCacher
	diskBlockCacheGetter
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

	// protects requests and lifetime
	reqMtx sync.RWMutex
	// the individual requests for this block pointer: they must be notified
	// once the block is returned
	requests []*blockRetrievalRequest
	// the cache lifetime for the retrieval
	cacheLifetime BlockCacheLifetime

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

	// This is a channel of channels to maximize the time that each request is
	// in the heap, allowing preemption as long as possible. This way, a
	// request only exits the heap once a worker is ready.
	workerQueue chan chan<- *blockRetrieval
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
func newBlockRetrievalQueue(numWorkers int,
	config blockRetrievalConfig) *blockRetrievalQueue {
	q := &blockRetrievalQueue{
		config:      config,
		log:         config.MakeLogger(""),
		ptrs:        make(map[blockPtrLookup]*blockRetrieval),
		heap:        &blockRetrievalHeap{},
		workerQueue: make(chan chan<- *blockRetrieval, numWorkers),
		workers:     make([]*blockRetrievalWorker, 0, numWorkers),
		doneCh:      make(chan struct{}),
	}
	q.prefetcher = newBlockPrefetcher(q, config)
	for i := 0; i < numWorkers; i++ {
		q.workers = append(q.workers,
			newBlockRetrievalWorker(config.blockGetter(), q))
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

// notifyWorker notifies workers that there is a new request for processing.
func (brq *blockRetrievalQueue) notifyWorker() {
	select {
	case <-brq.doneCh:
		retrieval := brq.popIfNotEmpty()
		if retrieval != nil {
			brq.FinalizeRequest(retrieval, nil, io.EOF)
		}
	// Get the next queued worker
	case ch := <-brq.workerQueue:
		retrieval := brq.popIfNotEmpty()
		ch <- retrieval
	}
}

// CacheAndPrefetch implements the BlockRetrieval interface for
// blockRetrievalQueue. It also updates the LRU time for the block in the disk
// cache.
func (brq *blockRetrievalQueue) CacheAndPrefetch(ctx context.Context,
	ptr BlockPointer, block Block, kmd KeyMetadata, priority int,
	lifetime BlockCacheLifetime, hasPrefetched bool) (err error) {
	dbc := brq.config.DiskBlockCache()
	if dbc != nil {
		if err := dbc.UpdateLRUTime(ctx, ptr.ID); err != nil {
			brq.log.CWarningf(ctx, "Error updating metadata: %+v", err)
		}
	}
	defer func() {
		if err != nil {
			brq.log.CWarningf(ctx, "Error Putting into the block cache: %+v",
				err)
		}
	}()
	if hasPrefetched {
		return brq.config.BlockCache().PutWithPrefetch(ptr, kmd.TlfID(), block,
			lifetime, true)
	}
	if priority < defaultOnDemandRequestPriority {
		// Only on-demand or higher priority requests can trigger prefetches.
		return brq.config.BlockCache().PutWithPrefetch(ptr, kmd.TlfID(), block,
			lifetime, false)
	}
	// We must let the cache know at this point that we've prefetched.
	// 1) To prevent any other Gets from prefetching.
	// 2) To prevent prefetching if a cache Put fails, since prefetching if
	//	  only useful when combined with the cache.
	err = brq.config.BlockCache().PutWithPrefetch(ptr, kmd.TlfID(), block,
		lifetime, true)
	switch err.(type) {
	case nil:
	case cachePutCacheFullError:
		brq.log.CDebugf(ctx, "Skipping prefetch because the cache "+
			"is full")
		return err
	default:
		// We should return the error here because otherwise we could thrash
		// the prefetcher.
		return err
	}
	// This must be called in a goroutine to prevent deadlock in case this
	// CacheAndPrefetch call was triggered by the prefetcher itself.
	go brq.Prefetcher().PrefetchAfterBlockRetrieved(block, ptr, kmd)
	return nil
}

func (brq *blockRetrievalQueue) checkCaches(ctx context.Context,
	priority int, kmd KeyMetadata, ptr BlockPointer, block Block,
	lifetime BlockCacheLifetime) error {
	// Attempt to retrieve the block from the cache. This might be a specific
	// type where the request blocks are CommonBlocks, but that direction can
	// Set correctly. The cache will never have CommonBlocks.  TODO: verify
	// that the returned lifetime here matches `lifetime` (which should always
	// be TransientEntry, since a PermanentEntry would have been served
	// directly from the cache elsewhere)?
	cachedBlock, hasPrefetched, _, err :=
		brq.config.BlockCache().GetWithPrefetch(ptr)
	if err == nil && cachedBlock != nil {
		block.Set(cachedBlock)
		return brq.CacheAndPrefetch(ctx, ptr, cachedBlock, kmd, priority,
			lifetime, hasPrefetched)
	}

	// Check the disk cache.
	dbc := brq.config.DiskBlockCache()
	if dbc == nil {
		return NoSuchBlockError{ptr.ID}
	}
	blockBuf, serverHalf, err := dbc.Get(ctx, kmd.TlfID(), ptr.ID)
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

	// TODO: once the DiskBlockCache knows about hasPrefetched, pipe that
	// through here.
	return brq.CacheAndPrefetch(ctx, ptr, block, kmd, priority, lifetime,
		false)
}

// Request submits a block request to the queue.
func (brq *blockRetrievalQueue) Request(ctx context.Context,
	priority int, kmd KeyMetadata, ptr BlockPointer, block Block,
	lifetime BlockCacheLifetime) <-chan error {
	// Only continue if we haven't been shut down
	ch := make(chan error, 1)
	select {
	case <-brq.doneCh:
		ch <- io.EOF
		return ch
	default:
	}
	if block == nil {
		ch <- errors.New("nil block passed to blockRetrievalQueue.Request")
		return ch
	}

	// Check caches before locking the mutex.
	err := brq.checkCaches(ctx, priority, kmd, ptr, block, lifetime)
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
			go brq.notifyWorker()
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
		br.reqMtx.Unlock()
		// If the new request priority is higher, elevate the retrieval in the
		// queue.  Skip this if the request is no longer in the queue (which
		// means it's actively being processed).
		if br.index != -1 && priority > br.priority {
			br.priority = priority
			heap.Fix(brq.heap, br.index)
		}
		return ch
	}
}

// Work accepts a worker's channel to assign work.
func (brq *blockRetrievalQueue) Work(ch chan<- *blockRetrieval) {
	brq.workerQueue <- ch
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

	// Cache the block and trigger prefetches if there is no error.
	if err == nil {
		// We treat this request as not having been prefetched, because the
		// only way to get here is if the request wasn't already cached.
		// Need to call with context.Background() because the retrieval's
		// context will be canceled as soon as this method returns.
		brq.CacheAndPrefetch(context.Background(), retrieval.blockPtr, block,
			retrieval.kmd, retrieval.priority, retrieval.cacheLifetime, false)
	}

	// This is a symbolic lock, since there shouldn't be any other goroutines
	// accessing requests at this point. But requests had contentious access
	// earlier, so we'll lock it here as well to maintain the integrity of the
	// lock.
	retrieval.reqMtx.Lock()
	defer retrieval.reqMtx.Unlock()
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
		for _, w := range brq.workers {
			w.Shutdown()
		}
		brq.prefetchMtx.Lock()
		defer brq.prefetchMtx.Unlock()
		brq.prefetcher.Shutdown()
		close(brq.doneCh)
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
