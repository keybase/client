// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
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

	nextMDLRU *lru.Cache
}

type mdCacheKey struct {
	tlf tlf.ID
	rev kbfsmd.Revision
	bid kbfsmd.BranchID
}

const (
	defaultMDCacheCapacity     = 5000
	defaultNextMDCacheCapacity = 100
)

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
	// Hard-code the nextMD cache size to something small, since only
	// one entry is used for each revoked device we need to verify.
	nextMDLRU, err := lru.New(defaultNextMDCacheCapacity)
	if err != nil {
		return nil
	}
	return &MDCacheStandard{lru: mdLRU, idLRU: idLRU, nextMDLRU: nextMDLRU}
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
func (md *MDCacheStandard) GetIDForHandle(handle *tlfhandle.Handle) (tlf.ID, error) {
	md.lock.RLock()
	defer md.lock.RUnlock()
	key := handle.GetCanonicalPath()
	tmp, ok := md.idLRU.Get(key)
	if !ok {
		return tlf.NullID, NoSuchTlfIDError{handle}
	}
	id, ok := tmp.(tlf.ID)
	if !ok {
		return tlf.NullID, errors.Errorf("Bad ID for handle %s", key)
	}
	return id, nil
}

// PutIDForHandle implements the MDCache interface for
// MDCacheStandard.
func (md *MDCacheStandard) PutIDForHandle(handle *tlfhandle.Handle, id tlf.ID) error {
	md.lock.RLock()
	defer md.lock.RUnlock()
	key := handle.GetCanonicalPath()
	md.idLRU.Add(key, id)
	return nil
}

// ChangeHandleForID implements the MDCache interface for
// MDCacheStandard.
func (md *MDCacheStandard) ChangeHandleForID(
	oldHandle *tlfhandle.Handle, newHandle *tlfhandle.Handle) {
	md.lock.RLock()
	defer md.lock.RUnlock()
	oldKey := oldHandle.GetCanonicalPath()
	tmp, ok := md.idLRU.Get(oldKey)
	if !ok {
		return
	}
	md.idLRU.Remove(oldKey)
	newKey := newHandle.GetCanonicalPath()
	md.idLRU.Add(newKey, tmp)
}

type mdcacheNextMDKey struct {
	tlfID     tlf.ID
	rootSeqno keybase1.Seqno
}

type mdcacheNextMDVal struct {
	nextKbfsRoot    *kbfsmd.MerkleRoot
	nextMerkleNodes [][]byte
	nextRootSeqno   keybase1.Seqno
}

// GetNextMD implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) GetNextMD(tlfID tlf.ID, rootSeqno keybase1.Seqno) (
	nextKbfsRoot *kbfsmd.MerkleRoot, nextMerkleNodes [][]byte,
	nextRootSeqno keybase1.Seqno, err error) {
	key := mdcacheNextMDKey{tlfID, rootSeqno}
	tmp, ok := md.nextMDLRU.Get(key)
	if !ok {
		return nil, nil, 0, NextMDNotCachedError{tlfID, rootSeqno}
	}
	val, ok := tmp.(mdcacheNextMDVal)
	if !ok {
		return nil, nil, 0, errors.Errorf(
			"Bad next MD for %s, seqno=%d", tlfID, rootSeqno)
	}
	return val.nextKbfsRoot, val.nextMerkleNodes, val.nextRootSeqno, nil
}

// PutNextMD implements the MDCache interface for MDCacheStandard.
func (md *MDCacheStandard) PutNextMD(
	tlfID tlf.ID, rootSeqno keybase1.Seqno, nextKbfsRoot *kbfsmd.MerkleRoot,
	nextMerkleNodes [][]byte, nextRootSeqno keybase1.Seqno) error {
	key := mdcacheNextMDKey{tlfID, rootSeqno}
	val := mdcacheNextMDVal{nextKbfsRoot, nextMerkleNodes, nextRootSeqno}
	md.nextMDLRU.Add(key, val)
	return nil
}
