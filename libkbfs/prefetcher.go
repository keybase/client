// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
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
	ptr            BlockPointer
	block          Block
	kmd            KeyMetadata
	priority       int
	lifetime       BlockCacheLifetime
	prefetchStatus PrefetchStatus
}

type prefetch struct {
	subtreeBlockCount int
	subtreeTriggered  bool
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
	// channel to allow synchronization on completion
	inFlightFetches chan (<-chan error)
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
		prefetches:               make(map[kbfsblock.ID]*prefetch),
		inFlightFetches:          make(chan (<-chan error), maxNumPrefetches),
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
		go p.shutdownLoop()
	}
	return p
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

// Walk up the block tree decrementing each node by one. Any
// zeroes we hit get marked complete and deleted.
// TODO: If we ever hit a lower number than the child, panic.
func (p *blockPrefetcher) completePrefetch(numBlocks int) func(kbfsblock.ID, *prefetch) {
	return func(blockID kbfsblock.ID, pp *prefetch) {
		pp.subtreeBlockCount -= numBlocks
		if pp.subtreeBlockCount < 0 {
			panic("completePrefetch overstepped its bounds")
		}
		if pp.subtreeBlockCount == 0 {
			// TODO: mark complete.
			delete(p.prefetches, blockID)
		}
	}
}

func (p *blockPrefetcher) cancelPrefetch(blockID kbfsblock.ID, pp *prefetch) {
	delete(p.prefetches, blockID)
}

func (p *blockPrefetcher) isShutdown() bool {
	select {
	case <-p.shutdownCh:
		return true
	default:
		return false
	}
}

// shutdownLoop tracks in-flight requests
func (p *blockPrefetcher) shutdownLoop() {
	for ch := range p.inFlightFetches {
		<-ch
	}
	close(p.doneCh)
}

func (p *blockPrefetcher) run() {
	for {
		// Handle shutdown: on a given loop, check if we should have shutdown
		// and whether our prefetches are done.
		// FIXME: this check is incorrect...since we aren't guaranteed that
		// this condition will ever be true.
		select {
		case blockID := <-p.prefetchMonitorSuccessCh:
			pre, ok := p.prefetches[blockID]
			if !ok {
				// TODO: remove this line once we've debugged.
				p.log.Debug("Missing prefetch completed for block %s", blockID)
				continue
			}
			if pre.subtreeBlockCount < 0 {
				panic("the subtreeBlockCount for a block should never be < 0")
			}
			// Since we decrement by `pre.subtreeBlockCount`, we're guaranteed
			// that `pre` will be removed from the prefetcher.
			p.applyToParentsRecursive(
				p.completePrefetch(pre.subtreeBlockCount), blockID, pre)
		case blockID := <-p.prefetchMonitorCancelCh:
			pre, ok := p.prefetches[blockID]
			if !ok {
				// TODO: remove this line once we've debugged.
				p.log.Debug("Missing prefetch canceled for block %s", blockID)
				continue
			}
			// Walk up the block tree and delete every parent.
			p.applyToParentsRecursive(p.cancelPrefetch, blockID, pre)
		case req := <-p.prefetchRequestCh:
			pre, isPrefetchWaiting := p.prefetches[req.ptr.ID]
			if isPrefetchWaiting {
				if pre.subtreeBlockCount == 0 {
					// If this happens, something screwed up since any path
					// that results in a `subtreeBlockCount` of 0 also cleans
					// up after itself.
					panic("prefetch is waiting but its subtreeBlockCount is 0")
				}
				if pre.subtreeTriggered {
					// Redundant prefetch request.
					if pre.subtreeBlockCount == 1 {
						// Only this block is left, and we didn't prefetch on a
						// previous prefetch through to the tail. So we cancel
						// up the tree.
						// TODO: make sure this doesn't screw up when request
						// priorities cause weird reordering within the tree
						// levels.
						p.applyToParentsRecursive(p.cancelPrefetch, req.ptr.ID,
							pre)
					}
					continue
				}
			}
			ctx, _ := context.WithTimeout(context.Background(),
				prefetchTimeout)
			// TODO: there is a potential optimization here that we can consider:
			// Currently every time a prefetch is triggered, we iterate through
			// all the block's child pointers. This is short circuited in
			// `TriggerPrefetch` if the block has a `prefetchStatus` of
			// `TriggeredPrefetch`. However, for synced trees we ignore that
			// and prefetch anyway. So here we would need to figure out a
			// heuristic to avoid that iteration.
			numBlocks, isTail, err := p.handlePrefetch(ctx, req.block, req.ptr,
				req.kmd, req.lifetime)
			if err != nil {
				// There's nothing for us to do when there's an error.
				continue
			}
			if isTail {
				// This is a tail block with no children.
				if isPrefetchWaiting {
					// Parent blocks are potentially waiting for this prefetch,
					// so we percolate the information up the tree that this
					// prefetch is done.
					// Note that only a tail block can trigger a completed
					// prefetch.
					p.applyToParentsRecursive(
						p.completePrefetch(1), req.ptr.ID, pre)
				}
				continue
			}
			// This is not a tail block.
			if numBlocks == 0 {
				// All the blocks to be triggered have already done so. Do
				// nothing.
				continue
			}
			if !isPrefetchWaiting {
				// This block doesn't appear in the prefetch tree, so it's the
				// root of a new prefetch tree. Create the prefetch monitor.
				pre = &prefetch{0, true, make(map[kbfsblock.ID]bool)}
				p.prefetches[req.ptr.ID] = pre
				// Add 1 to numBlocks since this block wasn't in the tree.
				numBlocks++
			}
			// Walk up the block tree and add numBlocks to every parent,
			// starting with this block.
			p.applyToParentsRecursive(func(_ kbfsblock.ID, pp *prefetch) {
				pp.subtreeBlockCount += numBlocks
			}, req.ptr.ID, pre)
		case <-p.doneCh:
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

func (p *blockPrefetcher) request(ctx context.Context, priority int,
	kmd KeyMetadata, ptr BlockPointer, block Block,
	lifetime BlockCacheLifetime) {
	ch := p.retriever.Request(ctx, priority, kmd, ptr, block, lifetime)
	select {
	case p.inFlightFetches <- ch:
	default:
		// Ensure this can't block.
		go func() {
			p.inFlightFetches <- ch
		}()
	}
}

// recordPrefetchParent maintains prefetch accounting for a given block. This
// maps the parent->child block relationship. `numBlocks` represents the number
// of blocks that need to be accounted in `parentBlockID`. `needNewFetch`
// represents whether we need to fetch `childBlockID`, or whether such a fetch
// has already been triggered.
func (p *blockPrefetcher) recordPrefetchParent(childBlockID kbfsblock.ID,
	parentBlockID kbfsblock.ID) (numBlocks int, needNewFetch bool) {
	// If the prefetch is already waiting, don't make it wait again.
	// Add the parent, however.
	pre, isPrefetchWaiting := p.prefetches[childBlockID]
	if !isPrefetchWaiting {
		pre = &prefetch{1, false, make(map[kbfsblock.ID]bool)}
		p.prefetches[childBlockID] = pre
		needNewFetch = true
	}
	if !pre.parents[parentBlockID] {
		// The new parent needs its subtree block count increased.
		pre.parents[parentBlockID] = true
		return 1, needNewFetch
	}
	return 0, needNewFetch
}

func (p *blockPrefetcher) prefetchIndirectFileBlock(ctx context.Context,
	parentBlockID kbfsblock.ID, b *FileBlock, kmd KeyMetadata,
	lifetime BlockCacheLifetime) (numBlocks int, isTail bool) {
	// Prefetch indirect block pointers.
	p.log.CDebugf(ctx, "Prefetching pointers for indirect file "+
		"block. Num pointers to prefetch: %d", len(b.IPtrs))
	startingPriority :=
		p.calculatePriority(fileIndirectBlockPrefetchPriority, kmd.TlfID())
	for i, ptr := range b.IPtrs {
		n, needNewFetch :=
			p.recordPrefetchParent(ptr.BlockPointer.ID, parentBlockID)
		numBlocks += n
		if needNewFetch {
			_ = p.retriever.Request(ctx, startingPriority-i, kmd,
				ptr.BlockPointer, b.NewEmpty(), lifetime)
		}
	}
	return numBlocks, len(b.IPtrs) == 0
}

func (p *blockPrefetcher) prefetchIndirectDirBlock(ctx context.Context,
	parentBlockID kbfsblock.ID, b *DirBlock, kmd KeyMetadata,
	lifetime BlockCacheLifetime) (numBlocks int, isTail bool) {
	// Prefetch indirect block pointers.
	p.log.CDebugf(context.TODO(), "Prefetching pointers for indirect dir "+
		"block. Num pointers to prefetch: %d", len(b.IPtrs))
	startingPriority :=
		p.calculatePriority(fileIndirectBlockPrefetchPriority, kmd.TlfID())
	for i, ptr := range b.IPtrs {
		n, needNewFetch :=
			p.recordPrefetchParent(ptr.BlockPointer.ID, parentBlockID)
		numBlocks += n
		if needNewFetch {
			_ = p.retriever.Request(ctx, startingPriority-i, kmd,
				ptr.BlockPointer, b.NewEmpty(), lifetime)
		}
	}
	return numBlocks, len(b.IPtrs) == 0
}

func (p *blockPrefetcher) prefetchDirectDirBlock(ctx context.Context,
	parentBlockID kbfsblock.ID, b *DirBlock, kmd KeyMetadata,
	lifetime BlockCacheLifetime) (numBlocks int, isTail bool) {
	p.log.CDebugf(context.TODO(), "Prefetching entries for directory block "+
		"ID %s. Num entries: %d", parentBlockID, len(b.Children))
	// Prefetch all DirEntry root blocks.
	dirEntries := dirEntriesBySizeAsc{dirEntryMapToDirEntries(b.Children)}
	sort.Sort(dirEntries)
	startingPriority :=
		p.calculatePriority(dirEntryPrefetchPriority, kmd.TlfID())
	totalNumBlocks := 0
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
		totalNumBlocks++
		n, needNewFetch :=
			p.recordPrefetchParent(entry.BlockPointer.ID, parentBlockID)
		numBlocks += n
		if needNewFetch {
			_ = p.retriever.Request(ctx, priority, kmd, entry.BlockPointer,
				block, lifetime)
		}
	}
	if totalNumBlocks == 0 {
		isTail = true
	}
	return numBlocks, isTail
}

// handlePrefetch allows the prefetcher to trigger prefetches. Whichever
// component is responsible for retrieving blocks will call this method once
// it's done retrieving a block. Returns `numBlocks` which indicates how many
// blocks with a parent of `ptr.ID` must complete for `ptr.ID`'s prefetch to be
// complete.
func (p *blockPrefetcher) handlePrefetch(ctx context.Context,
	b Block, ptr BlockPointer, kmd KeyMetadata, lifetime BlockCacheLifetime) (
	numBlocks int, isTail bool, err error) {
	switch b := b.(type) {
	case *FileBlock:
		if b.IsInd {
			numBlocks, isTail =
				p.prefetchIndirectFileBlock(ctx, ptr.ID, b, kmd, lifetime)
		} else {
			isTail = true
		}
	case *DirBlock:
		if b.IsInd {
			numBlocks, isTail =
				p.prefetchIndirectDirBlock(ctx, ptr.ID, b, kmd, lifetime)
		} else {
			numBlocks, isTail =
				p.prefetchDirectDirBlock(ctx, ptr.ID, b, kmd, lifetime)
		}
	default:
		// Skipping prefetch for block of unknown type (likely CommonBlock)
		return 0, false, errors.New("Unknown block type")
	}
	pre, ok := p.prefetches[ptr.ID]
	if !ok {
		panic("prefetch should exist but it does not")
	}
	pre.subtreeTriggered = true
	return numBlocks, isTail, nil
}

func (p *blockPrefetcher) triggerPrefetch(ptr BlockPointer, block Block,
	kmd KeyMetadata, priority int, lifetime BlockCacheLifetime,
	prefetchStatus PrefetchStatus) {
	select {
	case p.prefetchRequestCh <- prefetchRequest{
		ptr, block, kmd, priority, lifetime, prefetchStatus}:
	case <-p.shutdownCh:
		p.log.Warning("Skipping prefetch for block %v since "+
			"the prefetcher is shutdown", ptr.ID)
	default:
		go func() {
			select {
			case p.prefetchRequestCh <- prefetchRequest{
				ptr, block, kmd, priority, lifetime, prefetchStatus}:
			case <-p.shutdownCh:
				p.log.Warning("Skipping prefetch for block %v since "+
					"the prefetcher is shutdown", ptr.ID)
			}
		}()
	}
	return
}

// TriggerPrefetch triggers a prefetch if appropriate.
func (p *blockPrefetcher) TriggerPrefetch(ptr BlockPointer, block Block,
	kmd KeyMetadata, priority int, lifetime BlockCacheLifetime,
	prefetchStatus PrefetchStatus) PrefetchStatus {
	if prefetchStatus == FinishedPrefetch {
		// Finished prefetches can always be short circuited and respond on the
		// success channel (upstream prefetches might need to block on other
		// parallel prefetches too).
		p.NotifyPrefetchDone(ptr.ID)
		return prefetchStatus
	}
	// JZ: I'm removing this code to allow the prefetcher to decide how to
	// handle prefetches. prefetchStatus should only be used in the actual
	// prefetcher.
	//if brq.config.IsSyncedTlf(kmd.TlfID()) {
	//	// For synced blocks, callers need to be able to register themselves
	//	// with the prefetcher as parents of a given block, so that their
	//	// prefetch state is updated when the prefetch completes.
	//} else if prefetchStatus == TriggeredPrefetch {
	//	// If a prefetch has already been triggered for a block in a non-synced
	//	// TLF, then there is no waiting to be done.
	//	// TODO: maybe cancel here?
	//	// The issue is that if we don't cancel at some point down the tree,
	//	// the prefetcher will never remove the prefetches unless we do a true
	//	// deep prefetch.
	//	// On the other hand, if we _do_ cancel, we could be canceling a
	//	// prefetch that needs to finish. Since prefetches are de-duped, this
	//	// is a real risk..
	//	//
	//	// Plan A: store whether a block is a tail block in the `prefetch`. If
	//	// a tail block completes, and it makes its parent counter 0, it should
	//	// percolate. But if a non-tail block completes, it should percolate
	//	// its counter and remove blocks from the prefetch tree, but it
	//	// shouldn't mark the block done in the cache.
	//	// * Problem: if all the tail blocks complete before the non-tail is
	//	//   done fetching, there's no way to know that the mid-tree block should
	//	//   percolate doneness.
	//	//   * Answer: This is fine. If a mid-tree block triggers a prefetch,
	//	//   then it has already been retrieved. And if it doesn't trigger, we
	//	//   rely on the completion counter.
	//	return TriggeredPrefetch
	//}
	if priority < lowestTriggerPrefetchPriority {
		// Only high priority requests can trigger prefetches. Leave the
		// prefetchStatus unchanged.
		return prefetchStatus
	}
	p.triggerPrefetch(ptr, block, kmd, priority, lifetime, prefetchStatus)
	return TriggeredPrefetch
}

func (p *blockPrefetcher) CancelPrefetch(blockID kbfsblock.ID) {
	select {
	// After `p.shutdownCh` is closed, we still need to receive prefetch
	// cancelation until all prefetching is done.
	case <-p.doneCh:
	case p.prefetchMonitorCancelCh <- blockID:
	default:
		// Ensure this can't block.
		go func() {
			select {
			case <-p.doneCh:
			case p.prefetchMonitorCancelCh <- blockID:
			}
		}()
	}
}

func (p *blockPrefetcher) NotifyPrefetchDone(blockID kbfsblock.ID) {
	select {
	// After `p.shutdownCh` is closed, we still need to receive prefetch
	// cancelation until all prefetching is done.
	case <-p.doneCh:
	case p.prefetchMonitorSuccessCh <- blockID:
	default:
		// Ensure this can't block.
		go func() {
			select {
			case <-p.doneCh:
			case p.prefetchMonitorSuccessCh <- blockID:
			}
		}()
	}
}

// Shutdown implements the Prefetcher interface for blockPrefetcher.
func (p *blockPrefetcher) Shutdown() <-chan struct{} {
	select {
	case <-p.shutdownCh:
	default:
		close(p.shutdownCh)
		close(p.inFlightFetches)
	}
	return p.doneCh
}

// ShutdownCh implements the Prefetcher interface for blockPrefetcher.
func (p *blockPrefetcher) ShutdownCh() <-chan struct{} {
	return p.shutdownCh
}
