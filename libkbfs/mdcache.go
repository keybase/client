// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
)

// MDCacheStandard implements a simple LRU cache for per-folder
// metadata objects.
type MDCacheStandard struct {
	// lock protects `lru` from atomic operations that need atomicity
	// across multiple `lru` calls.
	lock  sync.RWMutex
	lru   *lru.Cache
	idLRU *lru.Cache
}

type mdCacheKey struct {
	tlf tlf.ID
	rev kbfsmd.Revision
	bid kbfsmd.BranchID
}

const defaultMDCacheCapacity = 5000

// NewMDCacheStandard constructs a new MDCacheStandard using the given
// cache capacity.
func NewMDCacheStandard(capacity int) *MDCacheStandard {
	mdLRU, err := lru.New(capacity)
	if err != nil {
		return nil
	}
	idLRU, err := lru.New(capacity)
	if err != nil {
		return nil
	}
	return &MDCacheStandard{lru: mdLRU, idLRU: idLRU}
}

// Get implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) Get(tlf tlf.ID, rev kbfsmd.Revision, bid kbfsmd.BranchID) (
	ImmutableRootMetadata, error) {
	md.lock.RLock()
	defer md.lock.RUnlock()
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
	md.lock.Lock()
	defer md.lock.Unlock()
	key := mdCacheKey{rmd.TlfID(), rmd.Revision(), rmd.BID()}
	if _, ok := md.lru.Get(key); ok {
		// Don't overwrite the cache.  In the case that `rmd` is
		// different from what's in the cache, we require that upper
		// layers manage the cache explicitly by deleting or replacing
		// it explicitly.
		return nil
	}
	md.lru.Add(key, rmd)
	return nil
}

// Delete implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) Delete(tlf tlf.ID, rev kbfsmd.Revision,
	bid kbfsmd.BranchID) {
	md.lock.Lock()
	defer md.lock.Unlock()
	key := mdCacheKey{tlf, rev, bid}
	md.lru.Remove(key)
}

// Replace implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) Replace(newRmd ImmutableRootMetadata,
	oldBID kbfsmd.BranchID) error {
	md.lock.Lock()
	defer md.lock.Unlock()
	oldKey := mdCacheKey{newRmd.TlfID(), newRmd.Revision(), oldBID}
	newKey := mdCacheKey{newRmd.TlfID(), newRmd.Revision(), newRmd.BID()}
	// TODO: implement our own LRU where we can replace the old data
	// without affecting the LRU status.
	md.lru.Remove(oldKey)
	md.lru.Add(newKey, newRmd)
	return nil
}

// MarkPutToServer implements the MDCache interface for
// MDCacheStandard.
func (md *MDCacheStandard) MarkPutToServer(
	tlf tlf.ID, rev kbfsmd.Revision, bid kbfsmd.BranchID) {
	md.lock.Lock()
	defer md.lock.Unlock()
	key := mdCacheKey{tlf, rev, bid}
	tmp, ok := md.lru.Get(key)
	if !ok {
		return
	}
	rmd, ok := tmp.(ImmutableRootMetadata)
	if !ok {
		return
	}
	rmd.putToServer = true
	md.lru.Add(key, rmd)
}

// GetIDForHandle implements the MDCache interface for
// MDCacheStandard.
func (md *MDCacheStandard) GetIDForHandle(handle *TlfHandle) (tlf.ID, error) {
	md.lock.RLock()
	defer md.lock.RUnlock()
	key := handle.GetCanonicalPath()
	tmp, ok := md.idLRU.Get(key)
	if !ok {
		return tlf.NullID, errors.WithStack(NoSuchTlfIDError{handle})
	}
	id, ok := tmp.(tlf.ID)
	if !ok {
		return tlf.NullID, errors.Errorf("Bad ID for handle %s", key)
	}
	return id, nil
}

// PutIDForHandle implements the MDCache interface for
// MDCacheStandard.
func (md *MDCacheStandard) PutIDForHandle(handle *TlfHandle, id tlf.ID) error {
	md.lock.RLock()
	defer md.lock.RUnlock()
	key := handle.GetCanonicalPath()
	md.idLRU.Add(key, id)
	return nil
}
