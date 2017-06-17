// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io"
	"sort"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	defaultIndirectPointerPrefetchCount int = 20
	fileIndirectBlockPrefetchPriority   int = -100
	dirEntryPrefetchPriority            int = -200
	updatePointerPrefetchPriority       int = 0
	defaultPrefetchPriority             int = -1024
)

type prefetcherConfig interface {
	dataVersioner
	logMaker
	blockCacher
}

type prefetchRequest struct {
	priority int
	kmd      KeyMetadata
	ptr      BlockPointer
	block    Block
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

func newBlockPrefetcher(retriever BlockRetriever, config prefetcherConfig) *blockPrefetcher {
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
			ctx, cancel := context.WithCancel(context.TODO())
			errCh := p.retriever.Request(ctx, req.priority, req.kmd, req.ptr, req.block, TransientEntry)
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer cancel()
				select {
				case err := <-errCh:
					if err != nil {
						p.log.CDebugf(ctx, "Done prefetch for block %s. Error: %+v", req.ptr.ID, err)
					}
				case <-p.shutdownCh:
					// Cancel but still wait so p.doneCh accurately represents
					// whether we still have requests pending.
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
	ptr BlockPointer, block Block, entryName string) error {
	if _, err := p.config.BlockCache().Get(ptr); err == nil {
		return nil
	}
	if err := checkDataVersion(p.config, path{}, ptr); err != nil {
		return err
	}
	select {
	case p.progressCh <- prefetchRequest{priority, kmd, ptr, block}:
		return nil
	case <-p.shutdownCh:
		return errors.Wrapf(io.EOF, "Skipping prefetch for block %v since "+
			"the prefetcher is shutdown", ptr.ID)
	}
}

func (p *blockPrefetcher) prefetchIndirectFileBlock(b *FileBlock,
	kmd KeyMetadata) {
	// Prefetch indirect block pointers.
	p.log.CDebugf(context.TODO(), "Prefetching pointers for indirect file "+
		"block. Num pointers to prefetch: %d", len(b.IPtrs))
	for _, ptr := range b.IPtrs {
		p.request(fileIndirectBlockPrefetchPriority, kmd, ptr.BlockPointer,
			b.NewEmpty(), "")
	}
}

func (p *blockPrefetcher) prefetchIndirectDirBlock(b *DirBlock,
	kmd KeyMetadata) {
	// Prefetch indirect block pointers.
	p.log.CDebugf(context.TODO(), "Prefetching pointers for indirect dir "+
		"block. Num pointers to prefetch: %d", len(b.IPtrs))
	for _, ptr := range b.IPtrs {
		_ = p.request(fileIndirectBlockPrefetchPriority, kmd,
			ptr.BlockPointer, b.NewEmpty(), "")
	}
}

func (p *blockPrefetcher) prefetchDirectDirBlock(ptr BlockPointer, b *DirBlock, kmd KeyMetadata) {
	p.log.CDebugf(context.TODO(), "Prefetching entries for directory block "+
		"ID %s. Num entries: %d", ptr.ID, len(b.Children))
	// Prefetch all DirEntry root blocks.
	dirEntries := dirEntriesBySizeAsc{dirEntryMapToDirEntries(b.Children)}
	sort.Sort(dirEntries)
	for i, entry := range dirEntries.dirEntries {
		// Prioritize small files
		priority := dirEntryPrefetchPriority - i
		var block Block
		switch entry.Type {
		case Dir:
			block = &DirBlock{}
		case File:
			block = &FileBlock{}
		case Exec:
			block = &FileBlock{}
		default:
			p.log.CDebugf(context.TODO(), "Skipping prefetch for entry of unknown type %d", entry.Type)
			continue
		}
		p.request(priority, kmd, entry.BlockPointer, block, entry.entryName)
	}
}

// PrefetchBlock implements the Prefetcher interface for blockPrefetcher.
func (p *blockPrefetcher) PrefetchBlock(
	block Block, ptr BlockPointer, kmd KeyMetadata, priority int) error {
	// TODO: Remove this log line.
	p.log.CDebugf(context.TODO(), "Prefetching block by request from upstream component. Priority: %d", priority)
	return p.request(priority, kmd, ptr, block, "")
}

// PrefetchAfterBlockRetrieved implements the Prefetcher interface for
// blockPrefetcher.
func (p *blockPrefetcher) PrefetchAfterBlockRetrieved(
	b Block, ptr BlockPointer, kmd KeyMetadata) {
	switch b := b.(type) {
	case *FileBlock:
		if b.IsInd {
			p.prefetchIndirectFileBlock(b, kmd)
		}
	case *DirBlock:
		if b.IsInd {
			p.prefetchIndirectDirBlock(b, kmd)
		} else {
			p.prefetchDirectDirBlock(ptr, b, kmd)
		}
	default:
		// Skipping prefetch for block of unknown type (likely CommonBlock)
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
