// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
)

// MDCacheStandard implements a simple LRU cache for per-folder
// metadata objects.
type MDCacheStandard struct {
	lru *lru.Cache
}

type mdCacheKey struct {
	tlf tlf.ID
	rev kbfsmd.Revision
	bid BranchID
}

const defaultMDCacheCapacity = 5000

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
func (md *MDCacheStandard) Get(tlf tlf.ID, rev kbfsmd.Revision, bid BranchID) (
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
	// TODO: is it worth the extra lookup here to make sure if there's
	// one already in the cache that it has the same MdID?
	key := mdCacheKey{rmd.TlfID(), rmd.Revision(), rmd.BID()}
	md.lru.Add(key, rmd)
	return nil
}

// Delete implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) Delete(tlf tlf.ID, rev kbfsmd.Revision,
	bid BranchID) {
	key := mdCacheKey{tlf, rev, bid}
	md.lru.Remove(key)
}

// Replace implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) Replace(newRmd ImmutableRootMetadata,
	oldBID BranchID) error {
	oldKey := mdCacheKey{newRmd.TlfID(), newRmd.Revision(), oldBID}
	newKey := mdCacheKey{newRmd.TlfID(), newRmd.Revision(), newRmd.BID()}
	// TODO: implement our own LRU where we can replace the old data
	// without affecting the LRU status.
	md.lru.Remove(oldKey)
	md.lru.Add(newKey, newRmd)
	return nil
}
