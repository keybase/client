package libkbfs

import (
	lru "github.com/hashicorp/golang-lru"
)

// MDCacheStandard implements a simple LRU cache for per-folder
// metadata objects.
type MDCacheStandard struct {
	lru *lru.Cache
}

type mdCacheKey struct {
	tlf    TlfID
	rev    MetadataRevision
	merged bool
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
func (md *MDCacheStandard) Get(tlf TlfID, rev MetadataRevision, merged bool) (
	*RootMetadata, error) {
	key := mdCacheKey{tlf, rev, merged}
	if tmp, ok := md.lru.Get(key); ok {
		if rmd, ok := tmp.(*RootMetadata); ok {
			return rmd, nil
		}
		return nil, BadMDError{tlf}
	}
	return nil, NoSuchMDError{tlf, rev, merged}
}

// Put implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) Put(rmd *RootMetadata) error {
	key := mdCacheKey{rmd.ID, rmd.Revision, !rmd.IsUnmergedSet()}
	md.lru.Add(key, rmd)
	return nil
}
