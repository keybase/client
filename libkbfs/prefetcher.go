package libkbfs

import (
	"io"
	"sort"

	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
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
	doneCh     chan struct{}
	eg         errgroup.Group
}

func newPrefetcher(retriever blockRetriever) *blockPrefetcher {
	p := &blockPrefetcher{
		retriever:  retriever,
		progressCh: make(chan (<-chan error)),
		doneCh:     make(chan struct{}),
	}
	go p.run()
	return p
}

func (p *blockPrefetcher) run() {
	for ch := range p.progressCh {
		ch := ch
		p.eg.Go(func() error {
			return <-ch
		})
	}
}

func (p *blockPrefetcher) request(priority int, kmd KeyMetadata, ptr BlockPointer, block Block) error {
	ctx, cancel := context.WithCancel(context.Background())
	ch := p.retriever.Request(ctx, priority, kmd, ptr, block, TransientEntry)
	select {
	case p.progressCh <- ch:
		return nil
	case <-p.doneCh:
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
			block = NewDirBlock()
		case File:
			block = NewFileBlock()
		case Exec:
			block = NewFileBlock()
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
	close(p.doneCh)
	ch := make(chan struct{})
	go func() {
		p.eg.Wait()
		close(ch)
	}()
	return ch
}
