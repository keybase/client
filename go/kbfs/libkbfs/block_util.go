// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

func isRecoverableBlockError(err error) bool {
	_, isArchiveError := err.(kbfsblock.ServerErrorBlockArchived)
	_, isDeleteError := err.(kbfsblock.ServerErrorBlockDeleted)
	_, isRefError := err.(kbfsblock.ServerErrorBlockNonExistent)
	_, isMaxExceededError := err.(kbfsblock.ServerErrorMaxRefExceeded)
	return isArchiveError || isDeleteError || isRefError || isMaxExceededError
}

// putBlockToServer either puts the full block to the block server, or
// just adds a reference, depending on the refnonce in blockPtr.
func putBlockToServer(
	ctx context.Context, bserv BlockServer, tlfID tlf.ID,
	blockPtr BlockPointer, readyBlockData ReadyBlockData,
	cacheType DiskBlockCacheType) error {
	var err error
	if blockPtr.RefNonce == kbfsblock.ZeroRefNonce {
		err = bserv.Put(ctx, tlfID, blockPtr.ID, blockPtr.Context,
			readyBlockData.buf, readyBlockData.serverHalf, cacheType)
	} else {
		// non-zero block refnonce means this is a new reference to an
		// existing block.
		err = bserv.AddBlockReference(ctx, tlfID, blockPtr.ID,
			blockPtr.Context)
	}
	return err
}

// PutBlockCheckLimitErrs is a thin wrapper around putBlockToServer (which
// calls either bserver.Put or bserver.AddBlockReference) that reports
// quota and disk limit errors.
func PutBlockCheckLimitErrs(ctx context.Context, bserv BlockServer,
	reporter Reporter, tlfID tlf.ID, blockPtr BlockPointer,
	readyBlockData ReadyBlockData, tlfName tlf.CanonicalName,
	cacheType DiskBlockCacheType) error {
	err := putBlockToServer(
		ctx, bserv, tlfID, blockPtr, readyBlockData, cacheType)
	switch typedErr := errors.Cause(err).(type) {
	case kbfsblock.ServerErrorOverQuota:
		if !typedErr.Throttled {
			// Report the error, but since it's not throttled the Put
			// actually succeeded, so return nil back to the caller.
			reporter.ReportErr(ctx, tlfName, tlfID.Type(),
				WriteMode, OverQuotaWarning{typedErr.Usage, typedErr.Limit})
			return nil
		}
	case *ErrDiskLimitTimeout:
		// Report this here in case the put is happening in a
		// background goroutine (via `SyncAll` perhaps) and wouldn't
		// otherwise be reported.  Mark the error as unreportable to
		// avoid the upper FS layer reporting it twice, if this block
		// put is the result of a foreground fsync.
		reporter.ReportErr(
			ctx, tlfName, tlfID.Type(), WriteMode, err)
		typedErr.reportable = false
		return err
	}
	return err
}

func doOneBlockPut(ctx context.Context, bserv BlockServer, reporter Reporter,
	tlfID tlf.ID, tlfName tlf.CanonicalName, ptr BlockPointer,
	bps blockPutState, blocksToRemoveChan chan BlockPointer,
	cacheType DiskBlockCacheType) error {
	readyBlockData, err := bps.getReadyBlockData(ctx, ptr)
	if err != nil {
		return err
	}
	err = PutBlockCheckLimitErrs(
		ctx, bserv, reporter, tlfID, ptr, readyBlockData, tlfName, cacheType)
	if err == nil {
		err = bps.synced(ptr)
	}
	if err != nil && isRecoverableBlockError(err) {
		block, blockErr := bps.getBlock(ctx, ptr)
		if blockErr == nil {
			fblock, ok := block.(*FileBlock)
			if ok && !fblock.IsInd {
				blocksToRemoveChan <- ptr
			}
		}
	}

	return err
}

// doBlockPuts writes all the pending block puts to the cache and
// server. If the err returned by this function satisfies
// isRecoverableBlockError(err), the caller should retry its entire
// operation, starting from when the MD successor was created.
//
// Returns a slice of block pointers that resulted in recoverable
// errors and should be removed by the caller from any saved state.
func doBlockPuts(ctx context.Context, bserv BlockServer, bcache BlockCache,
	reporter Reporter, log, deferLog traceLogger, tlfID tlf.ID,
	tlfName tlf.CanonicalName, bps blockPutState,
	cacheType DiskBlockCacheType) (blocksToRemove []BlockPointer, err error) {
	blockCount := bps.numBlocks()
	log.LazyTrace(ctx, "doBlockPuts with %d blocks", blockCount)
	defer func() {
		deferLog.LazyTrace(ctx, "doBlockPuts with %d blocks (err=%v)", blockCount, err)
	}()

	eg, groupCtx := errgroup.WithContext(ctx)

	blocks := make(chan BlockPointer, blockCount)

	numWorkers := blockCount
	if numWorkers > maxParallelBlockPuts {
		numWorkers = maxParallelBlockPuts
	}
	// A channel to list any blocks that have been archived or
	// deleted.  Any of these will result in an error, so the maximum
	// we'll get is the same as the number of workers.
	blocksToRemoveChan := make(chan BlockPointer, numWorkers)

	worker := func() error {
		for ptr := range blocks {
			err := doOneBlockPut(groupCtx, bserv, reporter, tlfID,
				tlfName, ptr, bps, blocksToRemoveChan, cacheType)
			if err != nil {
				return err
			}
		}
		return nil
	}
	for i := 0; i < numWorkers; i++ {
		eg.Go(worker)
	}

	for _, ptr := range bps.ptrs() {
		blocks <- ptr
	}
	close(blocks)

	err = eg.Wait()
	close(blocksToRemoveChan)
	if isRecoverableBlockError(err) {
		// Wait for all the outstanding puts to finish, to amortize
		// the work of re-doing the put.
		for ptr := range blocksToRemoveChan {
			// Let the caller know which blocks shouldn't be
			// retried.
			blocksToRemove = append(blocksToRemove, ptr)
			if block, err := bps.getBlock(ctx, ptr); err == nil {
				if fblock, ok := block.(*FileBlock); ok {
					// Remove each problematic block from the cache so
					// the redo can just make a new block instead.
					if err := bcache.DeleteKnownPtr(tlfID, fblock); err != nil {
						log.CWarningf(
							ctx, "Couldn't delete ptr for a block: %v", err)
					}
				}
			}
			if err := bcache.DeleteTransient(ptr.ID, tlfID); err != nil {
				log.CWarningf(ctx, "Couldn't delete block: %v", err)
			}
		}
	}
	return blocksToRemove, err
}

func assembleBlock(ctx context.Context, keyGetter blockKeyGetter,
	codec kbfscodec.Codec, cryptoPure cryptoPure, kmd KeyMetadata,
	blockPtr BlockPointer, block Block, buf []byte,
	blockServerHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	if err := kbfsblock.VerifyID(buf, blockPtr.ID); err != nil {
		return err
	}

	tlfCryptKey, err := keyGetter.GetTLFCryptKeyForBlockDecryption(
		ctx, kmd, blockPtr)
	if err != nil {
		return err
	}

	var encryptedBlock kbfscrypto.EncryptedBlock
	err = codec.Decode(buf, &encryptedBlock)
	if err != nil {
		return err
	}

	if idType, blockType :=
		blockPtr.ID.HashType(),
		encryptedBlock.Version.ToHashType(); idType != blockType {
		return errors.Errorf(
			"Block ID %s and encrypted block disagree on encryption method "+
				"(block ID: %s, encrypted block: %s)",
			blockPtr.ID, idType, blockType)
	}

	// decrypt the block
	err = cryptoPure.DecryptBlock(
		encryptedBlock, tlfCryptKey, blockServerHalf, block)
	if err != nil {
		return err
	}

	block.SetEncodedSize(uint32(len(buf)))
	return nil
}
