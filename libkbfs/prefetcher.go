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
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	fileIndirectBlockPrefetchPriority int           = -100
	dirEntryPrefetchPriority          int           = -200
	updatePointerPrefetchPriority     int           = 0
	defaultPrefetchPriority           int           = -1024
	prefetchTimeout                   time.Duration = time.Minute
)

type prefetcherConfig interface {
	syncedTlfGetterSetter
	dataVersioner
	logMaker
	blockCacher
}

type prefetchRequest struct {
	priority int
	kmd      KeyMetadata
	ptr      BlockPointer
	block    Block
	doneCh   chan<- struct{}
	errCh    chan<- struct{}
}

type blockPrefetcher struct {
	config prefetcherConfig
	log    logger.Logger
	// blockRetriever to retrieve blocks from the server
	retriever BlockRetriever
	// channel to synchronize prefetch requests with the prefetcher shutdown
	progressCh chan prefetchRequest
	// channel that is idempotently closed when a shutdown occurs
	shutdownCh chan struct{}
	// channel that is closed when a shutdown completes and all pending
	// prefetch requests are complete
	doneCh chan struct{}
}

var _ Prefetcher = (*blockPrefetcher)(nil)

func newBlockPrefetcher(retriever BlockRetriever,
	config prefetcherConfig) *blockPrefetcher {
	p := &blockPrefetcher{
		config:     config,
		retriever:  retriever,
		progressCh: make(chan prefetchRequest),
		shutdownCh: make(chan struct{}),
		doneCh:     make(chan struct{}),
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
		case req := <-p.progressCh:
			ctx, cancel := context.WithTimeout(context.Background(),
				prefetchTimeout)
			errCh := p.retriever.Request(ctx, req.priority, req.kmd, req.ptr,
				req.block, TransientEntry)
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
					req.errCh <- struct{}{}
					<-errCh
				}
				// TODO: doneCh should only receive once the Request's
				// prefetches are done. If no prefetches are triggered but the
				// request has child blocks, `errCh` should instead be assigned
				// to.
				req.doneCh <- struct{}{}
			}()
		case <-p.shutdownCh:
			return
		}
	}
}

func (p *blockPrefetcher) request(priority int, kmd KeyMetadata,
	ptr BlockPointer, block Block, entryName string,
	doneCh, errCh chan<- struct{}) error {
	if _, err := p.config.BlockCache().Get(ptr); err == nil {
		return nil
	}
	if err := checkDataVersion(p.config, path{}, ptr); err != nil {
		return err
	}
	select {
	case p.progressCh <- prefetchRequest{
		priority, kmd, ptr, block, doneCh, errCh}:
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
	kmd KeyMetadata) (<-chan struct{}, <-chan struct{}, int) {
	// Prefetch indirect block pointers.
	p.log.CDebugf(context.TODO(), "Prefetching pointers for indirect file "+
		"block. Num pointers to prefetch: %d", len(b.IPtrs))
	startingPriority :=
		p.calculatePriority(fileIndirectBlockPrefetchPriority, kmd.TlfID())
	numBlocks := len(b.IPtrs)
	doneCh := make(chan struct{}, numBlocks)
	errCh := make(chan struct{}, numBlocks)
	for i, ptr := range b.IPtrs {
		_ = p.request(startingPriority-i, kmd, ptr.BlockPointer,
			b.NewEmpty(), "", doneCh, errCh)
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
	kmd KeyMetadata, priority int) (<-chan struct{}, <-chan struct{}, error) {
	// TODO: Remove this log line.
	p.log.CDebugf(context.TODO(), "Prefetching block by request from "+
		"upstream component. Priority: %d", priority)
	doneCh := make(chan struct{}, 1)
	errCh := make(chan struct{}, 1)
	return doneCh, errCh,
		p.request(priority, kmd, ptr, block, "", doneCh, errCh)
}

// PrefetchAfterBlockRetrieved implements the Prefetcher interface for
// blockPrefetcher. Returns a channel that is closed once all the prefetches
// complete.
func (p *blockPrefetcher) PrefetchAfterBlockRetrieved(b Block,
	ptr BlockPointer, kmd KeyMetadata) (doneCh, errCh <-chan struct{},
	numBlocks int) {
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
