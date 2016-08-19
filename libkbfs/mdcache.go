// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

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
	tlf TlfID
	rev MetadataRevision
	bid BranchID
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
func (md *MDCacheStandard) Get(tlf TlfID, rev MetadataRevision, bid BranchID) (
	ImmutableRootMetadata, error) {
	key := mdCacheKey{tlf, rev, bid}
	if tmp, ok := md.lru.Get(key); ok {
		if rmd, ok := tmp.(ImmutableRootMetadata); ok {
			return rmd, nil
		}
		return ImmutableRootMetadata{}, BadMDError{tlf}
	}
	return ImmutableRootMetadata{}, NoSuchMDError{tlf, rev, bid}
}

// Put implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) Put(rmd ImmutableRootMetadata) error {
	key := mdCacheKey{rmd.TlfID(), rmd.Revision(), rmd.BID()}
	md.lru.Add(key, rmd)
	return nil
}
