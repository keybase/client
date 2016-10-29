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
	priority       int
	insertionOrder int
	requests       []*blockRetrievalRequest
}

type blockRetrievalQueue struct {
	mtx sync.RWMutex
	// uniqueness index
	ptrs       map[BlockPointer]*blockRetrieval
	priorities map[int]int
	// heap
	requests *blockRetrievalHeap
}

func NewBlockRetrievalQueue() *blockRetrievalQueue {
	return &blockRetrievalQueue{
		ptrs:       make(map[BlockPointer]*blockRetrieval),
		priorities: make(map[int]int),
		requests:   &blockRetrievalHeap{},
	}
}

func (brq *blockRetrievalQueue) Request(ctx context.Context, priority int, ptr BlockPointer, block Block) <-chan error {
	brq.mtx.Lock()
	defer brq.mtx.Unlock()
	var br *blockRetrieval
	var exists bool
	if br, exists = brq.ptrs[ptr]; !exists {
		// Add to the heap
		br = &blockRetrieval{ptr, priority, brq.priorities[priority], []*blockRetrievalRequest{}}
		brq.priorities[priority]++
		brq.ptrs[ptr] = br
		heap.Push(brq.requests, br)
	}
	ch := make(chan error, 1)
	br.requests = append(br.requests, &blockRetrievalRequest{ctx, block, ch})
	// If the new request priority is higher, elevate the request in the queue
	if priority > br.priority {
		br.priority = priority
		// TODO: track the index in each blockRetrieval
		heap.Fix(brq.requests, 0)
	}
	return ch
}
