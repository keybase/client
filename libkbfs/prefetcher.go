// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sort"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

const (
	fileIndirectBlockPrefetchPriority int           = -100
	dirEntryPrefetchPriority          int           = -200
	updatePointerPrefetchPriority     int           = 0
	defaultPrefetchPriority           int           = -1024
	prefetchTimeout                   time.Duration = 15 * time.Minute
	maxNumPrefetches                  int           = 1000
)

type prefetcherConfig interface {
	syncedTlfGetterSetter
	dataVersioner
	logMaker
	blockCacher
	diskBlockCacheGetter
}

type prefetchRequest struct {
	ptr      BlockPointer
	block    Block
	kmd      KeyMetadata
	lifetime BlockCacheLifetime
}

type prefetch struct {
	subtreeBlockCount int
	parents           map[kbfsblock.ID]bool
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
	prefetches map[kbfsblock.ID]*prefetch
}

var _ Prefetcher = (*blockPrefetcher)(nil)

func newBlockPrefetcher(retriever BlockRetriever,
	config prefetcherConfig) *blockPrefetcher {
	p := &blockPrefetcher{
		config:            config,
		retriever:         retriever,
		prefetchRequestCh: make(chan prefetchRequest, maxNumPrefetches),
		shutdownCh:        make(chan struct{}),
		doneCh:            make(chan struct{}),
		// TODO: re-evaluate the size of these channels
		prefetchMonitorSuccessCh: make(chan kbfsblock.ID, maxNumPrefetches),
		prefetchMonitorCancelCh:  make(chan kbfsblock.ID, maxNumPrefetches),
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

func (p *blockPrefetcher) addToPrefetch(blockID kbfsblock.ID, n int) {
	pre, ok := p.prefetches[blockID]
	if !ok {
		pre = &prefetch{0, make(map[kbfsblock.ID]bool)}
		p.prefetches[blockID] = pre
	}
	pre.subtreeBlockCount += n
}

func (p *blockPrefetcher) applyToParentsRecursive(f func(kbfsblock.ID, *prefetch),
	blockID kbfsblock.ID, pre *prefetch) {
	for b := range pre.parents {
		parent, ok := p.prefetches[b]
		if !ok {
			delete(pre.parents, b)
			continue
		}
		p.applyToParentsRecursive(f, b, parent)
	}
	f(blockID, pre)
}

func (p *blockPrefetcher) run() {
	// TODO: make prefetcher shutdown cleanly.
	for {
		select {
		case blockID := <-p.prefetchMonitorSuccessCh:
			pre, ok := p.prefetches[blockID]
			if !ok {
				p.log.Debug("Missing prefetch completed for block %s", blockID)
				continue
			}
			// Walk up the block tree decrementing each node by one. Any
			// zeroes we hit get marked complete and deleted.
			// TODO: If we ever hit a lower number than the child, panic.
			p.applyToParentsRecursive(func(blockID kbfsblock.ID, pp *prefetch) {
				pp.subtreeBlockCount--
				if pp.subtreeBlockCount == 0 {
					// TODO: mark complete.
					delete(p.prefetches, blockID)
				}
			}, blockID, pre)
		case blockID := <-p.prefetchMonitorCancelCh:
			pre, ok := p.prefetches[blockID]
			if !ok {
				p.log.Debug("Missing prefetch canceled for block %s", blockID)
				continue
			}
			// Walk up the block tree and delete every parent.
			p.applyToParentsRecursive(func(blockID kbfsblock.ID, pp *prefetch) {
				delete(p.prefetches, blockID)
			}, blockID, pre)
		case req := <-p.prefetchRequestCh:
			pre, ok := p.prefetches[req.ptr.ID]
			if !ok {
				// This block doesn't appear in the prefetch tree, so it's the
				// root of a new prefetch tree.
				// Create the prefetch monitor
				pre = &prefetch{0, make(map[kbfsblock.ID]bool)}
				p.prefetches[req.ptr.ID] = pre
			}
			// req.ptr contains the parent block ID for all blocks being
			// triggered below.
			ctx, cancel := context.WithTimeout(context.Background(),
				prefetchTimeout)
			numBlocks := p.prefetchAfterBlockRetrieved(ctx, req.block, req.ptr,
				req.kmd, req.lifetime)
			// TODO: `numBlocks == 0` means that this is a tail block and thus
			// we can percolate up prefetch doneness.
			if numBlocks > 0 {
				// Walk up the block tree and add numBlocks to every parent
				p.applyToParentsRecursive(func(_ kbfsblock.ID, pp *prefetch) {
					pp.subtreeBlockCount += numBlocks
				}, req.ptr.ID, pre)
			}
		case <-p.shutdownCh:
			return
		}
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

func (p *blockPrefetcher) prefetchIndirectFileBlock(ctx context.Context,
	b *FileBlock, kmd KeyMetadata, lifetime BlockCacheLifetime) (numBlocks int) {
	// Prefetch indirect block pointers.
	p.log.CDebugf(ctx, "Prefetching pointers for indirect file "+
		"block. Num pointers to prefetch: %d", len(b.IPtrs))
	startingPriority :=
		p.calculatePriority(fileIndirectBlockPrefetchPriority, kmd.TlfID())
	numBlocks = len(b.IPtrs)
	for i, ptr := range b.IPtrs {
		// TODO: add this entry's blockID to the prefetch monitor.
		_ = p.retriever.Request(ctx, startingPriority-i, kmd, ptr.BlockPointer,
			b.NewEmpty(), lifetime)
	}
	return numBlocks
}

func (p *blockPrefetcher) prefetchIndirectDirBlock(ctx context.Context,
	b *DirBlock, kmd KeyMetadata, lifetime BlockCacheLifetime) (numBlocks int) {
	// Prefetch indirect block pointers.
	p.log.CDebugf(context.TODO(), "Prefetching pointers for indirect dir "+
		"block. Num pointers to prefetch: %d", len(b.IPtrs))
	startingPriority :=
		p.calculatePriority(fileIndirectBlockPrefetchPriority, kmd.TlfID())
	numBlocks = len(b.IPtrs)
	for i, ptr := range b.IPtrs {
		// TODO: add this entry's blockID to the prefetch monitor.
		_ = p.retriever.Request(ctx, startingPriority-i, kmd, ptr.BlockPointer,
			b.NewEmpty(), lifetime)
	}
	return numBlocks
}

func (p *blockPrefetcher) prefetchDirectDirBlock(
	ctx context.Context, ptr BlockPointer, b *DirBlock, kmd KeyMetadata,
	lifetime BlockCacheLifetime) (numBlocks int) {
	p.log.CDebugf(context.TODO(), "Prefetching entries for directory block "+
		"ID %s. Num entries: %d", ptr.ID, len(b.Children))
	// Prefetch all DirEntry root blocks.
	dirEntries := dirEntriesBySizeAsc{dirEntryMapToDirEntries(b.Children)}
	sort.Sort(dirEntries)
	startingPriority :=
		p.calculatePriority(dirEntryPrefetchPriority, kmd.TlfID())
	numBlocks = 0
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
		// TODO: add this entry's blockID to the prefetch monitor.
		_ = p.retriever.Request(ctx, priority, kmd, entry.BlockPointer, block,
			lifetime)
		numBlocks++
	}
	return numBlocks
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
	b Block, ptr BlockPointer, kmd KeyMetadata, lifetime BlockCacheLifetime) (
	numBlocks int) {
	switch b := b.(type) {
	case *FileBlock:
		if b.IsInd {
			numBlocks = p.prefetchIndirectFileBlock(ctx, b, kmd, lifetime)
		}
	case *DirBlock:
		if b.IsInd {
			numBlocks = p.prefetchIndirectDirBlock(ctx, b, kmd, lifetime)
		} else {
			numBlocks = p.prefetchDirectDirBlock(ctx, ptr, b, kmd, lifetime)
		}
	default:
		// Skipping prefetch for block of unknown type (likely CommonBlock)
	}
	return numBlocks
}

func (p *blockPrefetcher) TriggerAndMonitorPrefetch(ptr BlockPointer,
	block Block, kmd KeyMetadata, lifetime BlockCacheLifetime) {
	// TODO: pass through priority properly.
	select {
	case p.prefetchRequestCh <- prefetchRequest{ptr, block, kmd, lifetime}:
	case <-p.shutdownCh:
		p.log.Warning("Skipping prefetch for block %v since "+
			"the prefetcher is shutdown", ptr.ID)
	default:
		go func() {
			select {
			case p.prefetchRequestCh <- prefetchRequest{ptr, block, kmd, lifetime}:
			case <-p.shutdownCh:
				p.log.Warning("Skipping prefetch for block %v since "+
					"the prefetcher is shutdown", ptr.ID)
			}
		}()
	}
	return
	//ctx, cancel := context.WithTimeout(context.Background(), prefetchTimeout)
	//ctx = CtxWithRandomIDReplayable(ctx, "prefetchForBlockID", ptr.ID.String(),
	//	p.log)
	//defer cancel()
	//numBlocks := p.prefetchAfterBlockRetrieved(block, ptr, kmd)

	//// If we have child blocks to prefetch, wait for them.
	//if numBlocks > 0 {
	//	for i := 0; i < numBlocks; i++ {
	//		select {
	//		case <-childPrefetchDoneCh:
	//			// We expect to receive from this channel `numBlocks` times,
	//			// after which we know the subtree of this block is done
	//			// prefetching.
	//			continue
	//		case <-ctx.Done():
	//			p.log.Warning("Prefetch canceled for block %s", ptr.ID)
	//			deepPrefetchCancelCh <- struct{}{}
	//			return
	//		case <-childPrefetchCancelCh:
	//			// One error means this block didn't finish prefetching.
	//			p.log.Warning("Prefetch canceled for block %s due to "+
	//				"downstream failure", ptr.ID)
	//			deepPrefetchCancelCh <- struct{}{}
	//			return
	//		case <-p.ShutdownCh():
	//			deepPrefetchCancelCh <- struct{}{}
	//			return
	//		}
	//	}
	//}

	//// Prefetches are done. Update the caches.
	//err := p.config.BlockCache().PutWithPrefetch(ptr, kmd.TlfID(),
	//	block, lifetime, FinishedPrefetch)
	//if err != nil {
	//	p.log.CWarningf(ctx, "Error updating cache after prefetch: %+v",
	//		err)
	//}
	//dbc := p.config.DiskBlockCache()
	//if dbc != nil {
	//	err := dbc.UpdateMetadata(ctx, ptr.ID, FinishedPrefetch)
	//	if err != nil {
	//		p.log.CWarningf(ctx, "Error updating disk cache after "+
	//			"prefetch: %+v", err)
	//		deepPrefetchCancelCh <- struct{}{}
	//		return
	//	}
	//}
	//p.log.CDebugf(ctx, "Finished prefetching for block %s", ptr.ID)
	//// Now prefetching is actually done.
	//deepPrefetchDoneCh <- struct{}{}
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
