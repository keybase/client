package libkbfs

import (
	"sync"

	"golang.org/x/net/context"
)

type blockRetrievalRequest struct {
	ctx    context.Context
	block  Block
	doneCh chan error
}

type blockRetrieval struct {
	blockPtr       BlockPointer
	index          int
	priority       int
	insertionOrder uint64
	requests       []*blockRetrievalRequest
}

type blockRetrievalQueue struct {
	mtx sync.RWMutex
	// uniqueness index
	ptrs map[BlockPointer]*blockRetrieval
	// global counter of insertions to queue
	insertionCount uint64
	// heap
	requests *blockRetrievalHeap
}

func NewBlockRetrievalQueue() *blockRetrievalQueue {
	return &blockRetrievalQueue{
		ptrs:     make(map[BlockPointer]*blockRetrieval),
		requests: &blockRetrievalHeap{},
	}
}

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
		heap.Push(brq.requests, br)
	}
	ch := make(chan error, 1)
	br.requests = append(br.requests, &blockRetrievalRequest{ctx, block, ch})
	// If the new request priority is higher, elevate the request in the queue
	if priority > br.priority {
		br.priority = priority
		heap.Fix(brq.requests, br.index)
	}
	return ch
}
