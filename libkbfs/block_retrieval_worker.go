// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io"
)

// blockRetrievalWorker processes blockRetrievalQueue requests
type blockRetrievalWorker struct {
	blockGetter
	stopCh     chan struct{}
	queue      *blockRetrievalQueue
	workCh     chan *blockRetrieval
	isPrefetch bool
}

// run runs the worker loop until Shutdown is called
func (brw *blockRetrievalWorker) run() {
	for {
		err := brw.HandleRequest()
		// Only io.EOF is relevant to the loop; other errors are handled in
		// FinalizeRequest
		if err == io.EOF {
			return
		}
	}
}

// newBlockRetrievalWorker returns a blockRetrievalWorker for a given
// blockRetrievalQueue, using the passed in blockGetter to obtain blocks for
// requests.
func newBlockRetrievalWorker(bg blockGetter,
	q *blockRetrievalQueue, isPrefetch bool) *blockRetrievalWorker {
	brw := &blockRetrievalWorker{
		blockGetter: bg,
		stopCh:      make(chan struct{}),
		queue:       q,
		workCh:      make(chan *blockRetrieval, 1),
		isPrefetch:  isPrefetch,
	}
	go brw.run()
	return brw
}

// HandleRequest is the main work method for the worker. It obtains a
// blockRetrieval from the queue, retrieves the block using
// blockGetter.getBlock, and responds to the subscribed requestors with the
// results.
func (brw *blockRetrievalWorker) HandleRequest() (err error) {
	if isPrefetch {
		brw.queue.PrefetchWork(brw.workCh)
	} else {
		brw.queue.Work(brw.workCh)
	}
	var retrieval *blockRetrieval
	select {
	case retrieval = <-brw.workCh:
		if retrieval == nil {
			panic("Received a nil block retrieval. This should never happen.")
		}
	case <-brw.stopCh:
		return io.EOF
	}

	var block Block
	defer func() {
		brw.queue.FinalizeRequest(retrieval, block, err)
	}()

	// Handle canceled contexts.
	select {
	case <-retrieval.ctx.Done():
		return retrieval.ctx.Err()
	default:
	}

	func() {
		retrieval.reqMtx.RLock()
		defer retrieval.reqMtx.RUnlock()
		block = retrieval.requests[0].block.NewEmpty()
	}()

	return brw.getBlock(retrieval.ctx, retrieval.kmd, retrieval.blockPtr, block)
}

// Shutdown shuts down the blockRetrievalWorker once its current work is done.
func (brw *blockRetrievalWorker) Shutdown() {
	select {
	case <-brw.stopCh:
	default:
		close(brw.stopCh)
	}
}
