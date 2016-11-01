// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"reflect"

	"golang.org/x/net/context"
)

type blockRetrievalWorker struct {
	stopCh chan struct{}
	queue  *blockRetrievalQueue
	config Config
}

func newBlockRetrievalWorker(q *blockRetrievalQueue, config Config) *blockRetrievalWorker {
	return &blockRetrievalWorker{
		stopCh: make(chan struct{}),
		queue:  q,
		config: config,
	}
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

func (brw *blockRetrievalWorker) getBlock(ctx context.Context, kmd KeyMetadata, blockPtr BlockPointer, block Block) error {
	bserv := brw.config.BlockServer()
	buf, blockServerHalf, err := bserv.Get(
		ctx, kmd.TlfID(), blockPtr.ID, blockPtr.BlockContext)
	if err != nil {
		// Temporary code to track down bad block
		// requests. Remove when not needed anymore.
		if _, ok := err.(BServerErrorBadRequest); ok {
			panic(fmt.Sprintf("Bad BServer request detected: err=%s, blockPtr=%s",
				err, blockPtr))
		}

		return err
	}

	crypto := brw.config.Crypto()
	if err := crypto.VerifyBlockID(buf, blockPtr.ID); err != nil {
		return err
	}

	tlfCryptKey, err := brw.config.KeyManager().
		GetTLFCryptKeyForBlockDecryption(ctx, kmd, blockPtr)
	if err != nil {
		return err
	}

	// construct the block crypt key
	blockCryptKey, err := crypto.UnmaskBlockCryptKey(
		blockServerHalf, tlfCryptKey)
	if err != nil {
		return err
	}

	var encryptedBlock EncryptedBlock
	err = brw.config.Codec().Decode(buf, &encryptedBlock)
	if err != nil {
		return err
	}

	// decrypt the block
	err = crypto.DecryptBlock(encryptedBlock, blockCryptKey, block)
	if err != nil {
		return err
	}

	block.SetEncodedSize(uint32(len(buf)))
	return nil
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
