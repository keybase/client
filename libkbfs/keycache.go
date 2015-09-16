package libkbfs

import (
	lru "github.com/hashicorp/golang-lru"
)

// KeyCacheStandard is an LRU-based implementation of the KeyCache interface.
type KeyCacheStandard struct {
	lru *lru.Cache
}

type keyCacheKey struct {
	tlf    TlfID
	keyGen KeyGen
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
func (k *KeyCacheStandard) GetTLFCryptKey(tlf TlfID, keyGen KeyGen) (
	TLFCryptKey, error) {
	cacheKey := keyCacheKey{tlf, keyGen}
	if entry, ok := k.lru.Get(cacheKey); ok {
		if key, ok := entry.(TLFCryptKey); ok {
			return key, nil
		}
		// shouldn't really be possible
		return TLFCryptKey{}, KeyCacheHitError{tlf, keyGen}
	}
	return TLFCryptKey{}, KeyCacheMissError{tlf, keyGen}
}

// PutTLFCryptKey implements the KeyCache interface for KeyCacheStandard.
func (k *KeyCacheStandard) PutTLFCryptKey(tlf TlfID, keyGen KeyGen, key TLFCryptKey) error {
	cacheKey := keyCacheKey{tlf, keyGen}
	k.lru.Add(cacheKey, key)
	return nil
}
