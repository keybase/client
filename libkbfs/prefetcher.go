package libkbfs

import (
	"golang.org/x/net/context"
)

type prefetcher struct {
	retriever blockRetriever
	config    Config
}

func newPrefetcher(config Config, retriever blockRetriever) *prefetcher {
	return &prefetcher{
		retriever: retriever,
		config:    config,
	}
}

func (p *prefetcher) Request(ctx context.Context, priority int, kmd KeyMetadata, ptr BlockPointer, block Block, lifetime BlockCacheLifetime) {
	// Only prefetch if the cache
	if _, err := p.config.BlockCache().Get(ptr); err == nil {
		return
	}
	requestCh := p.retriever.Request(ctx, priority, kmd, ptr, block)
	go func() {
		_ := <-requestCh

	}()
}
