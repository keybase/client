// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io"
	"sort"
	"sync"

	"golang.org/x/net/context"
)

const (
	defaultIndirectPointerPrefetchCount int = 20
	fileIndirectBlockPrefetchPriority   int = -100
	dirEntryPrefetchPriority            int = -200
	updatePointerPrefetchPriority       int = 0
)

type prefetchRequest struct {
	priority int
	kmd      KeyMetadata
	ptr      BlockPointer
	block    Block
}

// blockRetriever specifies a method for retrieving blocks asynchronously
type blockRetriever interface {
	Request(ctx context.Context, priority int, kmd KeyMetadata, ptr BlockPointer, block Block, lifetime BlockCacheLifetime) <-chan error
}

type blockPrefetcher struct {
	retriever  blockRetriever
	progressCh chan prefetchRequest
	shutdownCh chan struct{}
	doneCh     chan struct{}
}

var _ Prefetcher = (*blockPrefetcher)(nil)

func newBlockPrefetcher(retriever blockRetriever) *blockPrefetcher {
	p := &blockPrefetcher{
		retriever:  retriever,
		progressCh: make(chan prefetchRequest),
		shutdownCh: make(chan struct{}),
		doneCh:     make(chan struct{}),
	}
	if retriever == nil {
		p.Shutdown()
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
			if p.retriever == nil {
				continue
			}
			ctx, cancel := context.WithCancel(context.Background())
			ch := p.retriever.Request(ctx, req.priority, req.kmd, req.ptr, req.block, TransientEntry)
			wg.Add(1)
			go func() {
				defer wg.Done()
				select {
				case _ = <-ch:
				case <-p.shutdownCh:
					// Cancel but still wait so p.doneCh accurately represents
					// whether we still have requests pending.
					cancel()
					<-ch
				}
			}()
		case <-p.shutdownCh:
			return
		}
	}
}

func (p *blockPrefetcher) request(priority int, kmd KeyMetadata, ptr BlockPointer, block Block) error {
	// TODO: plumb through config, and then check the pointer and config data
	// versions before prefetching anything. Use
	// folderBlockOps.checkDataVersion as a template.
	select {
	case p.progressCh <- prefetchRequest{priority, kmd, ptr, block}:
		return nil
	case <-p.shutdownCh:
		return io.EOF
	}
}

func (p *blockPrefetcher) prefetchIndirectFileBlock(b *FileBlock, kmd KeyMetadata, priority int) {
	// Prefetch the first <n> indirect block pointers.
	// TODO: do something smart with subsequent blocks.
	numIPtrs := len(b.IPtrs)
	if numIPtrs > defaultIndirectPointerPrefetchCount {
		numIPtrs = defaultIndirectPointerPrefetchCount
	}
	for _, ptr := range b.IPtrs[:numIPtrs] {
		p.request(fileIndirectBlockPrefetchPriority, kmd,
			ptr.BlockPointer, b.NewEmpty())
	}
}

func (p *blockPrefetcher) prefetchIndirectDirBlock(b *DirBlock, kmd KeyMetadata, priority int) {
	// Prefetch the first <n> indirect block pointers.
	numIPtrs := len(b.IPtrs)
	if numIPtrs > defaultIndirectPointerPrefetchCount {
		numIPtrs = defaultIndirectPointerPrefetchCount
	}
	for _, ptr := range b.IPtrs[:numIPtrs] {
		_ = p.request(fileIndirectBlockPrefetchPriority, kmd,
			ptr.BlockPointer, b.NewEmpty())
	}
}

func (p *blockPrefetcher) prefetchDirectDirBlock(b *DirBlock, kmd KeyMetadata, priority int) {
	// Prefetch all DirEntry root blocks
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
			continue
		}
		p.request(priority, kmd, entry.BlockPointer, block)
	}
}

// PrefetchBlock implements the Prefetcher interface for blockPrefetcher.
func (p *blockPrefetcher) PrefetchBlock(block Block, ptr BlockPointer, kmd KeyMetadata, priority int) error {
	return p.request(priority, kmd, ptr, block)
}

// PrefetchDirBlock implements the Prefetcher interface for blockPrefetcher.
func (p *blockPrefetcher) PrefetchDirBlock(ptr BlockPointer, kmd KeyMetadata, priority int) error {
	return p.request(priority, kmd, ptr, &DirBlock{})
}

// PrefetchFileBlock implements the Prefetcher interface for blockPrefetcher.
func (p *blockPrefetcher) PrefetchFileBlock(ptr BlockPointer, kmd KeyMetadata, priority int) error {
	return p.request(priority, kmd, ptr, &FileBlock{})
}

// PrefetchAfterBlockRetrieved implements the Prefetcher interface for blockPrefetcher.
func (p *blockPrefetcher) PrefetchAfterBlockRetrieved(b Block, kmd KeyMetadata, priority int) {
	switch b := b.(type) {
	case *FileBlock:
		if b.IsInd && priority >= defaultOnDemandRequestPriority {
			p.prefetchIndirectFileBlock(b, kmd, priority)
		}
	case *DirBlock:
		if priority >= defaultOnDemandRequestPriority {
			if b.IsInd {
				p.prefetchIndirectDirBlock(b, kmd, priority)
			} else {
				p.prefetchDirectDirBlock(b, kmd, priority)
			}
		}
	default:
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
