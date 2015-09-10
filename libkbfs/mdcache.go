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
	tlf     TlfID
	rev     MetadataRevision
	mStatus MergeStatus
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
func (md *MDCacheStandard) Get(tlf TlfID, rev MetadataRevision,
	mStatus MergeStatus) (
	*RootMetadata, error) {
	key := mdCacheKey{tlf, rev, mStatus}
	if tmp, ok := md.lru.Get(key); ok {
		if rmd, ok := tmp.(*RootMetadata); ok {
			return rmd, nil
		}
		return nil, BadMDError{tlf}
	}
	return nil, NoSuchMDError{tlf, rev, mStatus}
}

// Put implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) Put(rmd *RootMetadata) error {
	key := mdCacheKey{rmd.ID, rmd.Revision, rmd.MergedStatus()}
	md.lru.Add(key, rmd)
	return nil
}

// Delete implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) Delete(rmd *RootMetadata) {
	key := mdCacheKey{rmd.ID, rmd.Revision, rmd.MergedStatus()}
	md.lru.Remove(key)
}
