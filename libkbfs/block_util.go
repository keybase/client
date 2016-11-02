// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

func isRecoverableBlockError(err error) bool {
	_, isArchiveError := err.(BServerErrorBlockArchived)
	_, isDeleteError := err.(BServerErrorBlockDeleted)
	_, isRefError := err.(BServerErrorBlockNonExistent)
	_, isMaxExceededError := err.(BServerErrorMaxRefExceeded)
	return isArchiveError || isDeleteError || isRefError || isMaxExceededError
}

// putBlockToServer either puts the full block to the block server, or
// just adds a reference, depending on the refnonce in blockPtr.
func putBlockToServer(ctx context.Context, bserv BlockServer, tlfID tlf.ID,
	blockPtr BlockPointer, readyBlockData ReadyBlockData) error {
	var err error
	if blockPtr.RefNonce == ZeroBlockRefNonce {
		err = bserv.Put(ctx, tlfID, blockPtr.ID, blockPtr.BlockContext,
			readyBlockData.buf, readyBlockData.serverHalf)
	} else {
		// non-zero block refnonce means this is a new reference to an
		// existing block.
		err = bserv.AddBlockReference(ctx, tlfID, blockPtr.ID,
			blockPtr.BlockContext)
	}
	return err
}

func putBlockCheckQuota(ctx context.Context, bserv BlockServer,
	reporter Reporter, tlfID tlf.ID, blockPtr BlockPointer,
	readyBlockData ReadyBlockData, tlfName CanonicalTlfName) error {
	err := putBlockToServer(ctx, bserv, tlfID, blockPtr, readyBlockData)
	if qe, ok := err.(BServerErrorOverQuota); ok && !qe.Throttled {
		reporter.ReportErr(ctx, tlfName, tlfID.IsPublic(),
			WriteMode, OverQuotaWarning{qe.Usage, qe.Limit})
		return nil
	}
	return err
}

func doOneBlockPut(ctx context.Context, bserv BlockServer, reporter Reporter,
	tlfID tlf.ID, tlfName CanonicalTlfName, blockState blockState,
	errChan chan error, blocksToRemoveChan chan *FileBlock) {
	err := putBlockCheckQuota(ctx, bserv, reporter, tlfID, blockState.blockPtr,
		blockState.readyBlockData, tlfName)
	if err == nil && blockState.syncedCb != nil {
		err = blockState.syncedCb()
	}
	if err != nil {
		if isRecoverableBlockError(err) {
			fblock, ok := blockState.block.(*FileBlock)
			if ok && !fblock.IsInd {
				blocksToRemoveChan <- fblock
			}
		}

		// one error causes everything else to cancel
		select {
		case errChan <- err:
		default:
			return
		}
	}
}

// doBlockPuts writes all the pending block puts to the cache and
// server. If the err returned by this function satisfies
// isRecoverableBlockError(err), the caller should retry its entire
// operation, starting from when the MD successor was created.
//
// Returns a slice of block pointers that resulted in recoverable
// errors and should be removed by the caller from any saved state.
func doBlockPuts(ctx context.Context, bserv BlockServer, bcache BlockCache,
	reporter Reporter, log logger.Logger, tlfID tlf.ID, tlfName CanonicalTlfName,
	bps blockPutState) ([]BlockPointer, error) {
	errChan := make(chan error, 1)
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	blocks := make(chan blockState, len(bps.blockStates))
	var wg sync.WaitGroup

	numWorkers := len(bps.blockStates)
	if numWorkers > maxParallelBlockPuts {
		numWorkers = maxParallelBlockPuts
	}
	wg.Add(numWorkers)
	// A channel to list any blocks that have been archived or
	// deleted.  Any of these will result in an error, so the maximum
	// we'll get is the same as the number of workers.
	blocksToRemoveChan := make(chan *FileBlock, numWorkers)

	worker := func() {
		defer wg.Done()
		for blockState := range blocks {
			doOneBlockPut(ctx, bserv, reporter, tlfID, tlfName,
				blockState, errChan, blocksToRemoveChan)
			select {
			// return early if the context has been canceled
			case <-ctx.Done():
				return
			default:
			}
		}
	}
	for i := 0; i < numWorkers; i++ {
		go worker()
	}

	for _, blockState := range bps.blockStates {
		blocks <- blockState
	}
	close(blocks)

	go func() {
		wg.Wait()
		close(errChan)
		close(blocksToRemoveChan)
	}()
	err := <-errChan
	var blocksToRemove []BlockPointer
	if isRecoverableBlockError(err) {
		// Wait for all the outstanding puts to finish, to amortize
		// the work of re-doing the put.
		for fblock := range blocksToRemoveChan {
			for i, bs := range bps.blockStates {
				if bs.block == fblock {
					// Let the caller know which blocks shouldn't be
					// retried.
					blocksToRemove = append(blocksToRemove,
						bps.blockStates[i].blockPtr)
				}
			}

			// Remove each problematic block from the cache so the
			// redo can just make a new block instead.
			if err := bcache.DeleteKnownPtr(tlfID, fblock); err != nil {
				log.CWarningf(ctx, "Couldn't delete ptr for a block: %v", err)
			}
		}
	}
	return blocksToRemove, err
}
