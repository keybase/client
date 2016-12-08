package libkbfs

type prefetcher struct {
	blockRetriever
	config Config
	cache  BlockCache
}

func newPrefetcher(config Config, cache BlockCache, retriever blockRetriever) *prefetcher {
	return &prefetcher{
		blockRetriever: retriever,
		config:         config,
		cache:          cache,
	}
}
