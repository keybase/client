package libkbfs

import (
	lru "github.com/hashicorp/golang-lru"
)

// MDCacheStandard implements a simple LRU cache for per-folder
// metadata objects.
type MDCacheStandard struct {
	lru *lru.Cache
}

// NewMDCacheStandard constructs a new MDCacheStandard using the given
// cache capacity.
func NewMDCacheStandard(capacity int) *MDCacheStandard {
	tmp, err := lru.New(capacity)
	if err != nil {
		return nil
	}
	return &MDCacheStandard{tmp}
}

// Get implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) Get(id MdID) (*RootMetadata, error) {
	if tmp, ok := md.lru.Get(id); ok {
		if rmd, ok := tmp.(*RootMetadata); ok {
			return rmd, nil
		}
		return nil, &BadMDError{id}
	}
	return nil, &NoSuchMDError{id}
}

// Put implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) Put(id MdID, rmd *RootMetadata) error {
	md.lru.Add(id, rmd)
	return nil
}
