// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
)

// KeyCacheStandard is an LRU-based implementation of the KeyCache interface.
type KeyCacheStandard struct {
	lru *lru.Cache
}

type keyCacheKey struct {
	tlf    tlf.ID
	keyGen kbfsmd.KeyGen
}

var _ KeyCache = (*KeyCacheStandard)(nil)

// NewKeyCacheStandard constructs a new KeyCacheStandard with the given
// cache capacity.
func NewKeyCacheStandard(capacity int) *KeyCacheStandard {
	head, err := lru.New(capacity)
	if err != nil {
		panic(err.Error())
	}
	return &KeyCacheStandard{head}
}

// GetTLFCryptKey implements the KeyCache interface for KeyCacheStandard.
func (k *KeyCacheStandard) GetTLFCryptKey(tlf tlf.ID, keyGen kbfsmd.KeyGen) (
	kbfscrypto.TLFCryptKey, error) {
	cacheKey := keyCacheKey{tlf, keyGen}
	if entry, ok := k.lru.Get(cacheKey); ok {
		if key, ok := entry.(kbfscrypto.TLFCryptKey); ok {
			return key, nil
		}
		// shouldn't really be possible
		return kbfscrypto.TLFCryptKey{}, KeyCacheHitError{tlf, keyGen}
	}
	return kbfscrypto.TLFCryptKey{}, KeyCacheMissError{tlf, keyGen}
}

// PutTLFCryptKey implements the KeyCache interface for KeyCacheStandard.
func (k *KeyCacheStandard) PutTLFCryptKey(
	tlf tlf.ID, keyGen kbfsmd.KeyGen, key kbfscrypto.TLFCryptKey) error {
	cacheKey := keyCacheKey{tlf, keyGen}
	k.lru.Add(cacheKey, key)
	return nil
}
