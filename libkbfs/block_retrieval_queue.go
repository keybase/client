// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"container/heap"
	"io"
	"reflect"
	"sync"

	"golang.org/x/net/context"
)

const (
	defaultBlockRetrievalWorkerQueueSize int = 100
	defaultOnDemandRequestPriority       int = 100
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
	//// Retrieval Metadata
	// the block pointer to retrieve
	blockPtr BlockPointer
	// the key metadata for the request
	kmd KeyMetadata
	// the individual requests for this block pointer: they must be notified
	// once the block is returned
	requests []*blockRetrievalRequest

	//// Queueing Metadata
	// the index of the retrieval in the heap
	index int
	// the priority of the retrieval: larger priorities are processed first
	priority int
	// state of global request counter when this retrieval was created;
	// maintains FIFO
	insertionOrder uint64
}

// blockRetrievalQueue manages block retrieval requests. Higher priority
// requests are executed first. Requests are executed in FIFO order within a
// given priority level.
type blockRetrievalQueue struct {
	// protects everything in this struct except workerQueue
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
	// Channel to represent whether we're done accepting requests
	doneCh chan struct{}
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
		select {
		case <-brq.doneCh:
			// Prevent interference with the heap while we're retrieving from it
			brq.mtx.Lock()
			defer brq.mtx.Unlock()
			if brq.heap.Len() > 0 {
				retrieval := heap.Pop(brq.heap).(*blockRetrieval)
				brq.FinalizeRequest(retrieval, nil, io.EOF)
			}
		default:
			// Get the next queued worker
			ch := <-brq.workerQueue
			// Prevent interference with the heap while we're retrieving from it
			brq.mtx.Lock()
			defer brq.mtx.Unlock()
			// Pop from the heap
			ch <- heap.Pop(brq.heap).(*blockRetrieval)
		}
	}()
}

// Request submits a block request to the queue.
func (brq *blockRetrievalQueue) Request(ctx context.Context, priority int, kmd KeyMetadata, ptr BlockPointer, block Block) <-chan error {
	// Only continue if we haven't been shut down
	select {
	case <-brq.doneCh:
		ch := make(chan error, 1)
		ch <- io.EOF
		return ch
	default:
	}

	brq.mtx.Lock()
	defer brq.mtx.Unlock()
	br, exists := brq.ptrs[ptr]
	if !exists {
		// Add to the heap
		br = &blockRetrieval{
			blockPtr:       ptr,
			kmd:            kmd,
			index:          -1,
			priority:       priority,
			insertionOrder: brq.insertionCount,
		}
		brq.insertionCount++
		brq.ptrs[ptr] = br
		heap.Push(brq.heap, br)
		defer brq.notifyWorker()
	}
	ch := make(chan error, 1)
	br.requests = append(br.requests, &blockRetrievalRequest{ctx, block, ch})
	// If the new request priority is higher, elevate the retrieval in the
	// queue.  Skip this if the request is no longer in the queue (which means
	// it's actively being processed).
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

// FinalizeRequest s the last step of a retrieval request once a block has been
// obtained. It removes the request from the blockRetrievalQueue, preventing
// more requests mutating the retrieval, then calls notifyBlockRequestor for
// all subscribed requests.
func (brq *blockRetrievalQueue) FinalizeRequest(retrieval *blockRetrieval, block Block, err error) {
	brq.mtx.Lock()
	delete(brq.ptrs, retrieval.blockPtr)
	brq.mtx.Unlock()

	if block == nil {
		for _, r := range retrieval.requests {
			req := r
			go func() {
				req.doneCh <- err
			}()
		}
		return
	}
	source := reflect.ValueOf(block).Elem()
	for _, r := range retrieval.requests {
		req := r
		go func() {
			// Copy the decrypted block to the caller
			dest := reflect.ValueOf(req.block).Elem()
			dest.Set(source)
			req.doneCh <- err
		}()
	}
}

// Shutdown is called when we are no longer accepting requests
func (brq *blockRetrievalQueue) Shutdown() {
	select {
	case <-brq.doneCh:
	default:
		close(brq.doneCh)
	}
}
