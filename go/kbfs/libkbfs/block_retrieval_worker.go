// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io"

	"github.com/eapache/channels"
	"github.com/keybase/client/go/kbfs/data"
)

// blockRetrievalWorker processes blockRetrievalQueue requests
type blockRetrievalWorker struct {
	blockGetter
	stopCh chan struct{}
	doneCh chan struct{}
	queue  *blockRetrievalQueue
	workCh channels.Channel
}

// run runs the worker loop until Shutdown is called
func (brw *blockRetrievalWorker) run() {
	defer close(brw.doneCh)
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
func newBlockRetrievalWorker(bg blockGetter, q *blockRetrievalQueue,
	workCh channels.Channel) *blockRetrievalWorker {
	brw := &blockRetrievalWorker{
		blockGetter: bg,
		stopCh:      make(chan struct{}),
		doneCh:      make(chan struct{}),
		queue:       q,
		workCh:      workCh,
	}
	go brw.run()
	return brw
}

// HandleRequest is the main work method for the worker. It obtains a
// blockRetrieval from the queue, retrieves the block using
// blockGetter.getBlock, and responds to the subscribed requestors with the
// results.
func (brw *blockRetrievalWorker) HandleRequest() (err error) {
	var retrieval *blockRetrieval
	select {
	case <-brw.workCh.Out():
		retrieval = brw.queue.popIfNotEmpty()
		if retrieval == nil {
			return nil
		}
	case <-brw.stopCh:
		return io.EOF
	}

	var block data.Block
	var cacheType DiskBlockCacheType
	defer func() {
		brw.queue.FinalizeRequest(retrieval, block, cacheType, err)
	}()

	// Handle canceled contexts.
	select {
	case <-retrieval.ctx.Done():
		return retrieval.ctx.Err()
	default:
	}

	var action BlockRequestAction
	func() {
		retrieval.reqMtx.RLock()
		defer retrieval.reqMtx.RUnlock()
		block = retrieval.requests[0].block.NewEmpty()
		action = retrieval.action
	}()

	// If we running with a "stop-if-full" action, before we fetch the
	// block, make sure the disk cache has room for it.
	if action.StopIfFull() {
		dbc := brw.queue.config.DiskBlockCache()
		if dbc != nil {
			hasRoom, _, err := dbc.DoesCacheHaveSpace(
				retrieval.ctx, action.CacheType())
			if err != nil {
				return err
			}
			if !hasRoom {
				return DiskCacheTooFullForBlockError{retrieval.blockPtr, action}
			}
		}
	}

	cacheType = action.CacheType()
	if action.DelayCacheCheck() {
		_, err := brw.queue.checkCaches(
			retrieval.ctx, retrieval.kmd, retrieval.blockPtr, block,
			action.WithoutDelayedCacheCheckAction())
		if err == nil {
			return nil
		}
	}

	return brw.getBlock(
		retrieval.ctx, retrieval.kmd, retrieval.blockPtr, block, cacheType)
}

// Shutdown shuts down the blockRetrievalWorker once its current work is done.
func (brw *blockRetrievalWorker) Shutdown() <-chan struct{} {
	select {
	case <-brw.stopCh:
	default:
		close(brw.stopCh)
	}
	return brw.doneCh
}
