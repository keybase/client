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
)

type prefetcher interface {
	HandleBlock(b Block, kmd KeyMetadata, priority int)
	Shutdown() <-chan struct{}
}

var _ prefetcher = (*blockPrefetcher)(nil)

type blockPrefetcher struct {
	retriever  blockRetriever
	progressCh chan (<-chan error)
	shutdownCh chan struct{}
	doneCh     chan struct{}
	sg         sync.WaitGroup
}

func newPrefetcher(retriever blockRetriever) *blockPrefetcher {
	p := &blockPrefetcher{
		retriever:  retriever,
		progressCh: make(chan (<-chan error)),
		shutdownCh: make(chan struct{}),
		doneCh:     make(chan struct{}),
	}
	go p.run()
	return p
}

func (p *blockPrefetcher) run() {
	for ch := range p.progressCh {
		ch := ch
		p.sg.Add(1)
		go func() error {
			defer p.sg.Done()
			return <-ch
		}()
	}
	p.sg.Wait()
	close(p.doneCh)
}

func (p *blockPrefetcher) request(priority int, kmd KeyMetadata, ptr BlockPointer, block Block) error {
	ctx, cancel := context.WithCancel(context.Background())
	ch := p.retriever.Request(ctx, priority, kmd, ptr, block, TransientEntry)
	select {
	case p.progressCh <- ch:
		return nil
	case <-p.shutdownCh:
		cancel()
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

func (p *blockPrefetcher) HandleBlock(b Block, kmd KeyMetadata, priority int) {
	switch b := b.(type) {
	case *FileBlock:
		if b.IsInd && priority >= defaultOnDemandRequestPriority {
			p.prefetchIndirectFileBlock(b, kmd, priority)
		}
	case *DirBlock:
		// If this is an on-demand request:
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

func (p *blockPrefetcher) Shutdown() <-chan struct{} {
	close(p.progressCh)
	close(p.shutdownCh)
	return p.doneCh
}
