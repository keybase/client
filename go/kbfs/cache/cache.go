// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package cache

import (
	"math/rand"
	"sync"

	"github.com/golang/groupcache/lru"
)

// Cache defines an interface for a cache that stores Measurable content.
// Eviction only happens when Add() is called, and there's no background
// goroutine for eviction.
type Cache interface {
	// Get tries to find and return data assiciated with key.
	Get(key Measurable) (data Measurable, ok bool)
	// Add adds or replaces data into the cache, associating it with key.
	// Entries are evicted when necessary.
	Add(key Measurable, data Measurable)
}

type randomEvictedCache struct {
	maxBytes int

	mu          sync.RWMutex
	cachedBytes int
	data        map[Measurable]memoizedMeasurable
	keys        []memoizedMeasurable
}

// NewRandomEvictedCache returns a Cache that uses random eviction strategy.
// The cache will have a capacity of maxBytes bytes. A zero-byte capacity cache
// is valid.
//
// Internally we store a memoizing wrapper for the raw Measurable to avoid
// unnecessarily frequent size calculations.
//
// Note that memoizing size means once the entry is in the cache, we never
// bother recalculating their size. It's fine if the size changes, but the
// cache eviction will continue using the old size.
func NewRandomEvictedCache(maxBytes int) Cache {
	return &randomEvictedCache{
		maxBytes: maxBytes,
		data:     make(map[Measurable]memoizedMeasurable),
	}
}

func (c *randomEvictedCache) entrySize(key Measurable, value Measurable) int {
	// Key size needs to be counted twice since they take space in both c.data
	// and c.keys. Note that we are ignoring the map overhead from c.data here.
	return 2*key.Size() + value.Size()
}

func (c *randomEvictedCache) evictOneLocked() {
	i := int(rand.Int63()) % len(c.keys)
	last := len(c.keys) - 1
	var toRemove memoizedMeasurable
	toRemove, c.keys[i] = c.keys[i], c.keys[last]
	c.cachedBytes -= c.entrySize(toRemove, c.data[toRemove.m])
	delete(c.data, toRemove.m)
	c.keys = c.keys[:last]
}

// Get impelments the Cache interface.
func (c *randomEvictedCache) Get(key Measurable) (data Measurable, ok bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	memoized, ok := c.data[key]
	if !ok {
		return nil, false
	}
	return memoized.m, ok
}

// Add implements the Cache interface.
func (c *randomEvictedCache) Add(key Measurable, data Measurable) {
	memoizedKey := memoizedMeasurable{m: key}
	memoizedData := memoizedMeasurable{m: data}
	increase := c.entrySize(memoizedKey, memoizedData)
	if increase > c.maxBytes {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if v, ok := c.data[key]; ok {
		decrease := c.entrySize(memoizedKey, v)
		c.cachedBytes -= decrease
	}
	c.cachedBytes += increase
	for c.cachedBytes > c.maxBytes {
		c.evictOneLocked()
	}
	c.data[key] = memoizedData
	c.keys = append(c.keys, memoizedKey)
}

// lruEvictedCache is a thin layer wrapped around
// github.com/golang/groupcache/lru.Cache that 1) makes it goroutine-safe; 2)
// caps on bytes; and 2) returns Measurable instead of interface{}
type lruEvictedCache struct {
	maxBytes int

	mu          sync.Mutex
	cachedBytes int
	data        *lru.Cache // not goroutine-safe; protected by mu
}

// NewLRUEvictedCache returns a Cache that uses LRU eviction strategy.
// The cache will have a capacity of maxBytes bytes. A zero-byte capacity cache
// is valid.
//
// Internally we store a memoizing wrapper for the raw Measurable to avoid
// unnecessarily frequent size calculations.
//
// Note that this means once the entry is in the cache, we never bother
// recalculating their size. It's fine if the size changes, but the cache
// eviction will continue using the old size.
func NewLRUEvictedCache(maxBytes int) Cache {
	c := &lruEvictedCache{
		maxBytes: maxBytes,
	}
	c.data = &lru.Cache{
		OnEvicted: func(key lru.Key, value interface{}) {
			// No locking is needed in this function because we do them in
			// public methods Get/Add, and RemoveOldest() is only called in the
			// Add method.
			if memoized, ok := value.(memoizedMeasurable); ok {
				if k, ok := key.(Measurable); ok {
					c.cachedBytes -= k.Size() + memoized.Size()
				}
			}
		},
	}
	return c
}

// Get impelments the Cache interface.
func (c *lruEvictedCache) Get(key Measurable) (data Measurable, ok bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	d, ok := c.data.Get(lru.Key(key))
	if !ok {
		return nil, false
	}
	memoized, ok := d.(memoizedMeasurable)
	if !ok {
		return nil, false
	}
	return memoized.m, ok
}

// Add implements the Cache interface.
func (c *lruEvictedCache) Add(key Measurable, data Measurable) {
	memoized := memoizedMeasurable{m: data}
	keySize := key.Size()
	if keySize+memoized.Size() > c.maxBytes {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if v, ok := c.data.Get(lru.Key(key)); ok {
		if m, ok := v.(memoizedMeasurable); ok {
			c.cachedBytes -= keySize + m.Size()
		}
	}
	c.cachedBytes += keySize + memoized.Size()
	for c.cachedBytes > c.maxBytes {
		c.data.RemoveOldest()
	}
	c.data.Add(lru.Key(key), memoized)
}
