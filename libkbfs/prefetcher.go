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

type dirEntries []DirEntry
type dirEntriesBySizeAsc struct{ dirEntries }
type dirEntriesBySizeDesc struct{ dirEntries }

func (d dirEntries) Len() int                     { return len(d) }
func (d dirEntries) Swap(i, j int)                { d[i], d[j] = d[j], d[i] }
func (d dirEntriesBySizeAsc) Less(i, j int) bool  { return d.dirEntries[i].Size < d.dirEntries[j].Size }
func (d dirEntriesBySizeDesc) Less(i, j int) bool { return d.dirEntries[i].Size > d.dirEntries[j].Size }

func dirEntryMapToDirEntries(entryMap map[string]DirEntry) dirEntries {
	dirEntries := make(dirEntries, 0, len(entryMap))
	for _, entry := range entryMap {
		dirEntries = append(dirEntries, entry)
	}
	return dirEntries
}

type prefetcher interface {
	HandleBlock(b Block, kmd KeyMetadata, priority int)
	Shutdown() <-chan struct{}
}

var _ prefetcher = (*blockPrefetcher)(nil)

type blockPrefetcher struct {
	retriever  blockRetriever
	progressCh chan (<-chan error)
	eg         errgroup.Group
}

func newPrefetcher(retriever blockRetriever) prefetcher {
	p := &blockPrefetcher{
		retriever:  retriever,
		progressCh: make(chan (<-chan error)),
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

func (p *blockPrefetcher) request(priority int, kmd KeyMetadata, ptr BlockPointer, block Block, lifetime BlockCacheLifetime) error {
	ctx, cancel := context.WithCancel(context.Background())
	ch := p.retriever.Request(ctx, priority, kmd, ptr, block, lifetime)
	select {
	case p.progressCh <- ch:
		return nil
	default:
		cancel()
		return io.EOF
	}
}

func (p *blockPrefetcher) prefetchIndirectFileBlock(b *FileBlock, kmd KeyMetadata, priority int) {
	// prefetch the first <n> indirect block pointers.
	// TODO: do something smart with subsequent blocks.
	numIPtrs := len(b.IPtrs)
	if numIPtrs > defaultIndirectPointerPrefetchCount {
		numIPtrs = defaultIndirectPointerPrefetchCount
	}
	for _, ptr := range b.IPtrs[:numIPtrs] {
		p.request(fileIndirectBlockPrefetchPriority, kmd,
			ptr.BlockPointer, b.NewEmpty(), TransientEntry)
	}
}

func (p *blockPrefetcher) prefetchIndirectDirBlock(b *DirBlock, kmd KeyMetadata, priority int) {
	numIPtrs := len(b.IPtrs)
	if numIPtrs > defaultIndirectPointerPrefetchCount {
		numIPtrs = defaultIndirectPointerPrefetchCount
	}
	for _, ptr := range b.IPtrs[:numIPtrs] {
		_ = p.request(fileIndirectBlockPrefetchPriority, kmd,
			ptr.BlockPointer, b.NewEmpty(), TransientEntry)
	}
}

func (p *blockPrefetcher) prefetchDirectDirBlock(b *DirBlock, kmd KeyMetadata, priority int) {
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
		p.request(priority, kmd, entry.BlockPointer,
			block, TransientEntry)
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
		// - If the block is indirect, prefetch the first <n> indirect block
		// pointers.
		// - If the block is direct (has Children), prefetch all DirEntry root
		// blocks.
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
	ch := make(chan struct{})
	go func() {
		p.eg.Wait()
		close(ch)
	}()
	return ch
}
