package libkbfs

import (
	"container/heap"
	"sync"

	"golang.org/x/net/context"
)

const (
	defaultBlockRetrievalWorkerQueueSize int = 100
)

// blockRetrievalRequest represents one consumer's request for a block.
type blockRetrievalRequest struct {
	ctx    context.Context
	block  Block
	doneCh chan error
}

// blockRetrieval contains the metadata for a given block retrieval. May
// represent many requests, all of which will be handled at once.
type blockRetrieval struct {
	// The block being retrieved
	blockPtr BlockPointer
	// The index of the retrieval in the heap
	index int
	// The priority of the retrieval
	priority int
	// The count of elements in the heap when this element was inserted.
	// Maintains FIFO.
	insertionOrder uint64
	// All the individual requests for this block. They must be notified once
	// the block is returned.
	requests []*blockRetrievalRequest
}

// blockRetrievalQueue manages block retrieval requests. Higher priority
// requests are executed first. Requests are executed in FIFO order within a
// given priority level.
type blockRetrievalQueue struct {
	mtx sync.RWMutex
	// queued or in progress retrievals
	ptrs map[BlockPointer]*blockRetrieval
	// global counter of insertions to queue
	// capacity: ~584 years at 1 billion requests/sec
	insertionCount uint64

	heap *blockRetrievalHeap
	// This is a channel of channels to maximize the time that each request is
	// in the heap, allowing preemption as long as possible. This way, a
	// request only exits the heap once a worker is ready.
	workerQueue chan chan *blockRetrieval
}

// newBlockRetrievalQueue creates a new block retrieval queue. The numWorkers
// parameter determines how many workers can concurrently call WorkOnRequest
// (more than numWorkers will block).
func newBlockRetrievalQueue(numWorkers int) *blockRetrievalQueue {
	return &blockRetrievalQueue{
		ptrs:        make(map[BlockPointer]*blockRetrieval),
		heap:        &blockRetrievalHeap{},
		workerQueue: make(chan chan *blockRetrieval, numWorkers),
	}
}

// notifyWorker notifies workers that there is a new request for processing.
func (brq *blockRetrievalQueue) notifyWorker() {
	go func() {
		// Get the next queued worker
		ch := <-brq.workerQueue
		// Prevent interference with the heap while we're retrieving from it
		brq.mtx.Lock()
		defer brq.mtx.Unlock()
		// Pop from the heap
		ch <- heap.Pop(brq.heap).(*blockRetrieval)
	}()
}

// Request submits a block request to the queue.
func (brq *blockRetrievalQueue) Request(ctx context.Context, priority int, ptr BlockPointer, block Block) <-chan error {
	brq.mtx.Lock()
	defer brq.mtx.Unlock()
	var br *blockRetrieval
	var exists bool
	if br, exists = brq.ptrs[ptr]; !exists {
		// Add to the heap
		br = &blockRetrieval{
			blockPtr:       ptr,
			index:          -1,
			priority:       priority,
			insertionOrder: brq.insertionCount,
			requests:       []*blockRetrievalRequest{},
		}
		brq.insertionCount++
		brq.ptrs[ptr] = br
		heap.Push(brq.heap, br)
		defer brq.notifyWorker()
	}
	ch := make(chan error, 1)
	br.requests = append(br.requests, &blockRetrievalRequest{ctx, block, ch})
	// If the new request priority is higher, elevate the request in the queue
	// Request might not be in the heap any more (could be processing)
	if br.index != -1 && priority > br.priority {
		br.priority = priority
		heap.Fix(brq.heap, br.index)
	}
	return ch
}

// WorkOnRequest returns a new channel for a worker to obtain a blockRetrieval.
func (brq *blockRetrievalQueue) WorkOnRequest() <-chan *blockRetrieval {
	ch := make(chan *blockRetrieval, 1)
	brq.workerQueue <- ch

	return ch
}

// FinalizeRequest communicates that any subsequent requestors for this block
// won't be notified by the current worker processing it.  This must be called
// before sending out the responses to the blockRetrievalRequests for a given
// blockRetrieval.
func (brq *blockRetrievalQueue) FinalizeRequest(ptr BlockPointer) {
	brq.mtx.Lock()
	defer brq.mtx.Unlock()

	delete(brq.ptrs, ptr)
}
