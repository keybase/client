package libkbfs

import (
	"sort"

	"golang.org/x/net/context"
)

const (
	defaultIndirectPointerPrefetchCount int = 20
	fileIndirectBlockPrefetchPriority   int = -100
	dirEntryPrefetchPriority            int = -200
)

type DirEntries []DirEntry
type DirEntriesBySizeAsc struct{ DirEntries }
type DirEntriesBySizeDesc struct{ DirEntries }

func (d DirEntries) Len() int                     { return len(d) }
func (d DirEntries) Swap(i, j int)                { d[i], d[j] = d[j], d[i] }
func (d DirEntriesBySizeAsc) Less(i, j int) bool  { return d.DirEntries[i].Size < d.DirEntries[j].Size }
func (d DirEntriesBySizeDesc) Less(i, j int) bool { return d.DirEntries[i].Size > d.DirEntries[j].Size }

func dirEntryMapToDirEntries(entryMap map[string]DirEntry) DirEntries {
	dirEntries := make(DirEntries, 0, len(entryMap))
	for _, entry := range entryMap {
		dirEntries = append(dirEntries, entry)
	}
	return dirEntries
}

type prefetcher interface {
	HandleBlock(b Block, kmd KeyMetadata, priority int) error
}

var _ prefetcher = (*blockPrefetcher)(nil)

type blockPrefetcher struct {
	retriever blockRetriever
}

func newPrefetcher(retriever blockRetriever) prefetcher {
	return &blockPrefetcher{
		retriever: retriever,
	}
}

func (p *blockPrefetcher) HandleBlock(b Block, kmd KeyMetadata, priority int) error {
	switch b := b.(type) {
	case *FileBlock:
		// If this is an indirect block and the priority is on demand, prefetch
		// the first <n> indirect block pointers.
		// TODO: do something smart with subsequent blocks.
		if b.IsInd && priority >= defaultOnDemandRequestPriority {
			numIPtrs := len(b.IPtrs)
			if numIPtrs > defaultIndirectPointerPrefetchCount {
				numIPtrs = defaultIndirectPointerPrefetchCount
			}
			for _, ptr := range b.IPtrs[:numIPtrs] {
				p.request(fileIndirectBlockPrefetchPriority, kmd,
					ptr.BlockPointer, NewFileBlock(), TransientEntry)
			}
		}
	case *DirBlock:
		// If this is an on-demand request:
		// - If the block is indirect, prefetch the first <n> indirect block
		// pointers.
		// - If the block is direct (has Children), prefetch all DirEntry root
		// blocks.
		if priority >= defaultOnDemandRequestPriority {
			if b.IsInd {
				numIPtrs := len(b.IPtrs)
				if numIPtrs > defaultIndirectPointerPrefetchCount {
					numIPtrs = defaultIndirectPointerPrefetchCount
				}
				for _, ptr := range b.IPtrs[:numIPtrs] {
					p.request(fileIndirectBlockPrefetchPriority, kmd,
						ptr.BlockPointer, NewFileBlock(), TransientEntry)
				}
			} else {
				dirEntries := DirEntriesBySizeAsc{dirEntryMapToDirEntries(b.Children)}
				sort.Sort(dirEntries)
				for i, entry := range dirEntries.DirEntries {
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
		}
	default:
	}
	return nil
}

func (p *blockPrefetcher) request(priority int, kmd KeyMetadata, ptr BlockPointer, block Block, lifetime BlockCacheLifetime) {
	// TODO: track these requests and do something intelligent with
	// cancellation
	ctx := context.Background()
	// Returns a buffered channel, so we don't need to read from it.
	_ = p.retriever.Request(ctx, priority, kmd, ptr, block, lifetime)
}
