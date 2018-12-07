// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"errors"

	"github.com/keybase/client/go/kbfs/cache"
)

// KeyBundleCache is an interface to a key bundle cache for use with v3 metadata.
type KeyBundleCache interface {
	// GetTLFReaderKeyBundle returns the TLFReaderKeyBundleV3 for
	// the given TLFReaderKeyBundleID, or nil if there is none.
	GetTLFReaderKeyBundle(TLFReaderKeyBundleID) (*TLFReaderKeyBundleV3, error)
	// GetTLFWriterKeyBundle returns the TLFWriterKeyBundleV3 for
	// the given TLFWriterKeyBundleID, or nil if there is none.
	GetTLFWriterKeyBundle(TLFWriterKeyBundleID) (*TLFWriterKeyBundleV3, error)
	// PutTLFReaderKeyBundle stores the given TLFReaderKeyBundleV3.
	PutTLFReaderKeyBundle(TLFReaderKeyBundleID, TLFReaderKeyBundleV3)
	// PutTLFWriterKeyBundle stores the given TLFWriterKeyBundleV3.
	PutTLFWriterKeyBundle(TLFWriterKeyBundleID, TLFWriterKeyBundleV3)
}

// KeyBundleCacheStandard is an LRU-based implementation of the KeyBundleCache interface.
type KeyBundleCacheStandard struct {
	cache cache.Cache
}

var _ KeyBundleCache = (*KeyBundleCacheStandard)(nil)

// NewKeyBundleCacheLRU constructs a new KeyBundleCacheStandard with LRU
// eviction strategy. The capacity of the cache is set to capacityBytes bytes.
func NewKeyBundleCacheLRU(capacityBytes int) *KeyBundleCacheStandard {
	return &KeyBundleCacheStandard{cache.NewLRUEvictedCache(capacityBytes)}
}

// NewKeyBundleCacheRandom constructs a new KeyBundleCacheStandard with random
// eviction strategy. The capacity of the cache is set to capacityBytes bytes.
func NewKeyBundleCacheRandom(capacityBytes int) *KeyBundleCacheStandard {
	return &KeyBundleCacheStandard{cache.NewRandomEvictedCache(capacityBytes)}
}

// GetTLFReaderKeyBundle implements the KeyBundleCache interface for KeyBundleCacheStandard.
func (k *KeyBundleCacheStandard) GetTLFReaderKeyBundle(
	bundleID TLFReaderKeyBundleID) (*TLFReaderKeyBundleV3, error) {
	if entry, ok := k.cache.Get(bundleID); ok {
		if rkb, ok := entry.(TLFReaderKeyBundleV3); ok {
			return &rkb, nil
		}
		// Shouldn't be possible.
		return nil, errors.New("Invalid key bundle type")
	}
	return nil, nil
}

// GetTLFWriterKeyBundle implements the KeyBundleCache interface for KeyBundleCacheStandard.
func (k *KeyBundleCacheStandard) GetTLFWriterKeyBundle(
	bundleID TLFWriterKeyBundleID) (*TLFWriterKeyBundleV3, error) {
	if entry, ok := k.cache.Get(bundleID); ok {
		if wkb, ok := entry.(TLFWriterKeyBundleV3); ok {
			return &wkb, nil
		}
		// Shouldn't be possible.
		return nil, errors.New("Invalid key bundle type")
	}
	return nil, nil
}

// PutTLFReaderKeyBundle implements the KeyBundleCache interface for KeyBundleCacheStandard.
func (k *KeyBundleCacheStandard) PutTLFReaderKeyBundle(
	bundleID TLFReaderKeyBundleID, rkb TLFReaderKeyBundleV3) {
	k.cache.Add(bundleID, rkb)
}

// PutTLFWriterKeyBundle implements the KeyBundleCache interface for KeyBundleCacheStandard.
func (k *KeyBundleCacheStandard) PutTLFWriterKeyBundle(
	bundleID TLFWriterKeyBundleID, wkb TLFWriterKeyBundleV3) {
	k.cache.Add(bundleID, wkb)
}
