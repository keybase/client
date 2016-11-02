// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/kbfs/tlf"
)

// KeyBundleCacheStandard is an LRU-based implementation of the KeyBundleCache interface.
type KeyBundleCacheStandard struct {
	lru *lru.Cache
}

var _ KeyBundleCache = (*KeyBundleCacheStandard)(nil)

type keyBundleCacheKey struct {
	tlf         tlf.ID
	bundleIDStr string
	isWriter    bool
}

// NewKeyBundleCacheStandard constructs a new KeyBundleCacheStandard with the given
// cache capacity.
func NewKeyBundleCacheStandard(capacity int) *KeyBundleCacheStandard {
	head, err := lru.New(capacity)
	if err != nil {
		panic(err.Error())
	}
	return &KeyBundleCacheStandard{head}
}

// GetTLFReaderKeyBundle implements the KeyBundleCache interface for KeyBundleCacheStandard.
func (k *KeyBundleCacheStandard) GetTLFReaderKeyBundle(
	tlf tlf.ID, bundleID TLFReaderKeyBundleID) (*TLFReaderKeyBundleV3, error) {
	cacheKey := keyBundleCacheKey{tlf, bundleID.String(), false}
	if entry, ok := k.lru.Get(cacheKey); ok {
		if rkb, ok := entry.(*TLFReaderKeyBundleV3); ok {
			return rkb, nil
		}
		// Shouldn't be possible.
		return nil, errors.New("Invalid key bundle type")
	}
	return nil, nil
}

// GetTLFWriterKeyBundle implements the KeyBundleCache interface for KeyBundleCacheStandard.
func (k *KeyBundleCacheStandard) GetTLFWriterKeyBundle(
	tlf tlf.ID, bundleID TLFWriterKeyBundleID) (*TLFWriterKeyBundleV3, error) {
	cacheKey := keyBundleCacheKey{tlf, bundleID.String(), true}
	if entry, ok := k.lru.Get(cacheKey); ok {
		if rkb, ok := entry.(*TLFWriterKeyBundleV3); ok {
			return rkb, nil
		}
		// Shouldn't be possible.
		return nil, errors.New("Invalid key bundle type")
	}
	return nil, nil
}

// PutTLFReaderKeyBundle implements the KeyBundleCache interface for KeyBundleCacheStandard.
func (k *KeyBundleCacheStandard) PutTLFReaderKeyBundle(
	tlf tlf.ID, bundleID TLFReaderKeyBundleID, rkb *TLFReaderKeyBundleV3) {
	cacheKey := keyBundleCacheKey{tlf, bundleID.String(), false}
	k.lru.Add(cacheKey, rkb)
}

// PutTLFWriterKeyBundle implements the KeyBundleCache interface for KeyBundleCacheStandard.
func (k *KeyBundleCacheStandard) PutTLFWriterKeyBundle(
	tlf tlf.ID, bundleID TLFWriterKeyBundleID, wkb *TLFWriterKeyBundleV3) {
	cacheKey := keyBundleCacheKey{tlf, bundleID.String(), true}
	k.lru.Add(cacheKey, wkb)
}
