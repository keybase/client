// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	fileIndirectBlockPrefetchPriority int           = -100
	dirEntryPrefetchPriority          int           = -200
	updatePointerPrefetchPriority     int           = 0
	defaultPrefetchPriority           int           = -1024
	prefetchTimeout                   time.Duration = 15 * time.Minute
)

type prefetcherConfig interface {
	syncedTlfGetterSetter
	dataVersioner
	logMaker
	blockCacher
	diskBlockCacheGetter
}

type prefetchRequest struct {
	priority      int
	kmd           KeyMetadata
	ptr           BlockPointer
	block         Block
	parentBlockID kbfsblock.ID
}

type prefetch struct {
	remainingChildBlockCount int
	parentBlockIDs           map[kbfsblock.ID]bool
}

type blockPrefetcher struct {
	config prefetcherConfig
	log    logger.Logger
	// blockRetriever to retrieve blocks from the server
	retriever BlockRetriever
	// channel to synchronize prefetch requests with the prefetcher shutdown
	prefetchRequestCh chan prefetchRequest
	// channel that is idempotently closed when a shutdown occurs
	shutdownCh chan struct{}
	// channel that is closed when a shutdown completes and all pending
	// prefetch requests are complete
	doneCh chan struct{}
	// channels to track the success or failure of prefetches
	prefetchMonitorSuccessCh chan kbfsblock.ID
	prefetchMonitorCancelCh  chan kbfsblock.ID
	// map to store prefetch metadata
	prefetches map[kbfsblock.ID]prefetch
}

var _ Prefetcher = (*blockPrefetcher)(nil)

func newBlockPrefetcher(retriever BlockRetriever,
	config prefetcherConfig) *blockPrefetcher {
	p := &blockPrefetcher{
		config:            config,
		retriever:         retriever,
		prefetchRequestCh: make(chan prefetchRequest),
		shutdownCh:        make(chan struct{}),
		doneCh:            make(chan struct{}),
	}
	if config != nil {
		p.log = config.MakeLogger("PRE")
	} else {
		p.log = logger.NewNull()
	}
	if retriever == nil {
		// If we pass in a nil retriever, this prefetcher shouldn't do
		// anything. Treat it as already shut down.
		p.Shutdown()
		close(p.doneCh)
	} else {
		go p.run()
	}
	return p
}

func (p *blockPrefetcher) run() {
	var wg sync.WaitGroup
	defer func() {
		wg.Wait()
		close(p.doneCh)
	}()
	for {
		select {
		case blockID := <-p.prefetchMonitorSuccessCh:
			pre, ok := p.prefetches[blockID]
			if !ok {
				p.log.Debug("Missing prefetch completed for block %s", blockID)
				continue
			}
			pre.remainingChildBlockCount--
			if pre.remainingChildBlockCount <= 0 {
				delete(p.prefetches, blockID)
				// TODO: handle completion
				// Walk up the block tree decrementing each node by one. Any
				// zeroes we hit get marked complete and deleted. If we ever
				// hit a lower number than the child, panic.
			}
		case blockID := <-p.prefetchMonitorCancelCh:
			pre, ok := p.prefetches[blockID]
			if !ok {
				p.log.Debug("Missing prefetch canceled for block %s", blockID)
				continue
			}
			delete(p.prefetches, blockID)
			// TODO: handle cancelation
			// Walk up the block tree and delete every parent all the way to
			// the root.
		case req := <-p.prefetchRequestCh:
			// TODO: this goroutine should actually trigger all prefetches.
			// `PrefetchBlock` and `prefetchAfterBlockRetrieved` should all
			// happen here.
			ctx, cancel := context.WithTimeout(context.Background(),
				prefetchTimeout)
			errCh := p.retriever.Request(ctx, req.priority,
				req.kmd, req.ptr, req.block, TransientEntry)
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer cancel()
				select {
				case err := <-errCh:
					if err != nil {
						p.log.CDebugf(ctx, "Done prefetch for block %s. "+
							"Error: %+v", req.ptr.ID, err)
					}
				case <-p.shutdownCh:
					// Cancel but still wait for the request to finish, so that
					// p.doneCh accurately represents whether we still have
					// requests pending.
					cancel()
					<-errCh
				}
			}()
		case <-p.shutdownCh:
			return
		}
	}
}

func (p *blockPrefetcher) request(priority int, kmd KeyMetadata,
	ptr BlockPointer, block Block, entryName string,
	parentBlockID kbfsblock.ID) error {
	select {
	case p.prefetchRequestCh <- prefetchRequest{
		priority, kmd, ptr, block, parentBlockID}:
		return nil
	case <-p.shutdownCh:
		return errors.Wrapf(io.EOF, "Skipping prefetch for block %v since "+
			"the prefetcher is shutdown", ptr.ID)
	}
}

// calculatePriority returns either a base priority for an unsynced TLF or a
// high priority for a synced TLF.
func (p *blockPrefetcher) calculatePriority(basePriority int,
	tlfID tlf.ID) int {
	if p.config.IsSyncedTlf(tlfID) {
		return defaultOnDemandRequestPriority - 1
	}
	return basePriority
}

func (p *blockPrefetcher) prefetchIndirectFileBlock(b *FileBlock,
	kmd KeyMetadata, parentBlockID kbfsblock.ID) (numBlocks int) {
	// Prefetch indirect block pointers.
	p.log.CDebugf(context.TODO(), "Prefetching pointers for indirect file "+
		"block. Num pointers to prefetch: %d", len(b.IPtrs))
	startingPriority :=
		p.calculatePriority(fileIndirectBlockPrefetchPriority, kmd.TlfID())
	numBlocks = len(b.IPtrs)
	for i, ptr := range b.IPtrs {
		_ = p.request(startingPriority-i, kmd, ptr.BlockPointer,
			b.NewEmpty(), "", parentBlockID)
	}
	return doneCh, errCh, numBlocks
}

func (p *blockPrefetcher) prefetchIndirectDirBlock(b *DirBlock,
	kmd KeyMetadata) (<-chan struct{}, <-chan struct{}, int) {
	// Prefetch indirect block pointers.
	p.log.CDebugf(context.TODO(), "Prefetching pointers for indirect dir "+
		"block. Num pointers to prefetch: %d", len(b.IPtrs))
	startingPriority :=
		p.calculatePriority(fileIndirectBlockPrefetchPriority, kmd.TlfID())
	numBlocks := len(b.IPtrs)
	doneCh := make(chan struct{}, numBlocks)
	errCh := make(chan struct{}, numBlocks)
	for i, ptr := range b.IPtrs {
		_ = p.request(startingPriority-i, kmd, ptr.BlockPointer, b.NewEmpty(),
			"", doneCh, errCh)
	}
	return doneCh, errCh, numBlocks
}

func (p *blockPrefetcher) prefetchDirectDirBlock(ptr BlockPointer, b *DirBlock,
	kmd KeyMetadata) (<-chan struct{}, <-chan struct{}, int) {
	p.log.CDebugf(context.TODO(), "Prefetching entries for directory block "+
		"ID %s. Num entries: %d", ptr.ID, len(b.Children))
	// Prefetch all DirEntry root blocks.
	dirEntries := dirEntriesBySizeAsc{dirEntryMapToDirEntries(b.Children)}
	sort.Sort(dirEntries)
	startingPriority :=
		p.calculatePriority(dirEntryPrefetchPriority, kmd.TlfID())
	numBlocks := 0
	doneCh := make(chan struct{}, len(dirEntries.dirEntries))
	errCh := make(chan struct{}, len(dirEntries.dirEntries))
	for i, entry := range dirEntries.dirEntries {
		// Prioritize small files
		priority := startingPriority - i
		var block Block
		switch entry.Type {
		case Dir:
			block = &DirBlock{}
		case File:
			block = &FileBlock{}
		case Exec:
			block = &FileBlock{}
		default:
			p.log.CDebugf(context.TODO(), "Skipping prefetch for entry of "+
				"unknown type %d", entry.Type)
			continue
		}
		_ = p.request(priority, kmd, entry.BlockPointer, block, entry.entryName,
			doneCh, errCh)
		numBlocks++
	}
	return doneCh, errCh, numBlocks
}

// PrefetchBlock implements the Prefetcher interface for blockPrefetcher.
func (p *blockPrefetcher) PrefetchBlock(block Block, ptr BlockPointer,
	kmd KeyMetadata, priority int) error {
	// TODO: Remove this log line.
	p.log.CDebugf(context.TODO(), "Prefetching block by request from "+
		"upstream component. Priority: %d", priority)
	return doneCh, errCh,
		p.request(priority, kmd, ptr, block, "", kbfsblock.ID{})
}

// prefetchAfterBlockRetrieved allows the prefetcher to trigger prefetches
// after a block has been retrieved. Whichever component is responsible for
// retrieving blocks will call this method once it's done retrieving a
// block.
// `doneCh` is a semaphore with a `numBlocks` count. Once we've read from
// it `numBlocks` times, the whole underlying block tree has been
// prefetched.
// `errCh` can be read up to `numBlocks` times, but any writes to it mean
// that the deep prefetch won't complete. So even a single read from
// `errCh` by a caller can be used to communicate failure of the deep
// prefetch to its parent.
func (p *blockPrefetcher) prefetchAfterBlockRetrieved(ctx context.Context,
	b Block, ptr BlockPointer, kmd KeyMetadata) (numBlocks int) {
	switch b := b.(type) {
	case *FileBlock:
		if b.IsInd {
			doneCh, errCh, numBlocks = p.prefetchIndirectFileBlock(b, kmd)
		}
	case *DirBlock:
		if b.IsInd {
			doneCh, errCh, numBlocks = p.prefetchIndirectDirBlock(b, kmd)
		} else {
			doneCh, errCh, numBlocks = p.prefetchDirectDirBlock(ptr, b, kmd)
		}
	default:
		// Skipping prefetch for block of unknown type (likely CommonBlock)
	}
	return doneCh, errCh, numBlocks
}

func (p *blockPrefetcher) TriggerAndMonitorPrefetch(ptr BlockPointer,
	block Block, kmd KeyMetadata, lifetime BlockCacheLifetime) {
	ctx, cancel := context.WithTimeout(context.Background(), prefetchTimeout)
	ctx = CtxWithRandomIDReplayable(ctx, "prefetchForBlockID", ptr.ID.String(),
		p.log)
	defer cancel()
	numBlocks := p.prefetchAfterBlockRetrieved(block, ptr, kmd)

	// If we have child blocks to prefetch, wait for them.
	if numBlocks > 0 {
		for i := 0; i < numBlocks; i++ {
			select {
			case <-childPrefetchDoneCh:
				// We expect to receive from this channel `numBlocks` times,
				// after which we know the subtree of this block is done
				// prefetching.
				continue
			case <-ctx.Done():
				p.log.Warning("Prefetch canceled for block %s", ptr.ID)
				deepPrefetchCancelCh <- struct{}{}
				return
			case <-childPrefetchCancelCh:
				// One error means this block didn't finish prefetching.
				p.log.Warning("Prefetch canceled for block %s due to "+
					"downstream failure", ptr.ID)
				deepPrefetchCancelCh <- struct{}{}
				return
			case <-p.ShutdownCh():
				deepPrefetchCancelCh <- struct{}{}
				return
			}
		}
	}

	// Prefetches are done. Update the caches.
	err := p.config.BlockCache().PutWithPrefetch(ptr, kmd.TlfID(),
		block, lifetime, FinishedPrefetch)
	if err != nil {
		p.log.CWarningf(ctx, "Error updating cache after prefetch: %+v",
			err)
	}
	dbc := p.config.DiskBlockCache()
	if dbc != nil {
		err := dbc.UpdateMetadata(ctx, ptr.ID, FinishedPrefetch)
		if err != nil {
			p.log.CWarningf(ctx, "Error updating disk cache after "+
				"prefetch: %+v", err)
			deepPrefetchCancelCh <- struct{}{}
			return
		}
	}
	p.log.CDebugf(ctx, "Finished prefetching for block %s", ptr.ID)
	// Now prefetching is actually done.
	deepPrefetchDoneCh <- struct{}{}
}

func (p *blockPrefetcher) CancelPrefetch(blockID kbfsblock.ID) {
	select {
	case <-p.shutdownCh:
	case p.prefetchMonitorCancelCh <- blockID:
	}
}

func (p *blockPrefetcher) NotifyPrefetchDone(blockID kbfsblock.ID) {
	select {
	case <-p.shutdownCh:
	case p.prefetchMonitorSuccessCh <- blockID:
	}
}

// Shutdown implements the Prefetcher interface for blockPrefetcher.
func (p *blockPrefetcher) Shutdown() <-chan struct{} {
	select {
	case <-p.shutdownCh:
	default:
		close(p.shutdownCh)
	}
	return p.doneCh
}

// ShutdownCh implements the Prefetcher interface for blockPrefetcher.
func (p *blockPrefetcher) ShutdownCh() <-chan struct{} {
	return p.shutdownCh
}
