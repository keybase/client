// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"reflect"

	"golang.org/x/net/context"
)

type blockRetrievalWorker struct {
	blockGetter
	stopCh chan struct{}
	queue  *blockRetrievalQueue
}

func newBlockRetrievalWorker(bg blockGetter, q *blockRetrievalQueue) *blockRetrievalWorker {
	brw := &blockRetrievalWorker{
		blockGetter: bg,
		stopCh:      make(chan struct{}),
		queue:       q,
	}
	go brw.Run()
	return brw
}

func (brw *blockRetrievalWorker) finalizeRetrieval(retrieval *blockRetrieval, block Block, err error) {
	brw.queue.FinalizeRequest(retrieval.blockPtr)
	sourceVal := reflect.ValueOf(block).Elem()
	for _, req := range retrieval.requests {
		// Copy the decrypted block to the caller
		destVal := reflect.ValueOf(req.block).Elem()
		destVal.Set(sourceVal)
		req.doneCh <- err
	}
}

func (brw *blockRetrievalWorker) HandleRequest() (err error) {
	retrieval := <-brw.queue.WorkOnRequest()
	// Create a new block of the same type as the first request
	typ := reflect.TypeOf(retrieval.requests[0].block).Elem()
	block := reflect.New(typ).Interface().(Block)
	defer brw.finalizeRetrieval(retrieval, block, err)

	// Pick one of the still-active contexts to use
	var ctx context.Context
	canceled := true
	for _, req := range retrieval.requests {
		// Handle canceled contexts
		select {
		case <-req.ctx.Done():
		default:
			ctx = req.ctx
			canceled = false
		}
	}
	if canceled {
		return context.Canceled
	}

	return brw.getBlock(ctx, retrieval.kmd, retrieval.blockPtr, block)
}

func (brw *blockRetrievalWorker) Run() {
	for {
		select {
		case <-brw.stopCh:
			return
		default:
			brw.HandleRequest()
		}
	}
}

func (brw *blockRetrievalWorker) Shutdown() {
	select {
	case <-brw.stopCh:
	default:
		close(brw.stopCh)
	}
}
