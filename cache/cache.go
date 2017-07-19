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
	Get(key string) (data Measurable, ok bool)
	// Add adds data into the cache, associating it with key. Entries are
	// evicted when necessary.
	Add(key string, data Measurable)
}

type randomEvictedCache struct {
	maxBytes int

	mu          sync.RWMutex
	cachedBytes int
	data        map[string]memoizedMeasurable
	keys        []string
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
		data:     make(map[string]memoizedMeasurable),
	}
}

func (c *randomEvictedCache) evictOneLocked() {
	i := int(rand.Int63()) % len(c.keys)
	last := len(c.keys) - 1
	var toRemove string
	toRemove, c.keys[i] = c.keys[i], c.keys[last]
	c.cachedBytes -= 2*len(toRemove) + c.data[toRemove].Size()
	delete(c.data, toRemove)
	c.keys = c.keys[:last]
}

// Get impelments the Cache interface.
func (c *randomEvictedCache) Get(key string) (data Measurable, ok bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	memoized, ok := c.data[key]
	if !ok {
		return nil, false
	}
	return memoized.m, ok
}

// Add implements the Cache interface.
func (c *randomEvictedCache) Add(key string, data Measurable) {
	memoized := memoizedMeasurable{m: data}
	increase := 2*len(key) + memoized.Size()
	if increase > c.maxBytes {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.data[key]; !ok {
		c.cachedBytes += increase
	}
	for c.cachedBytes > c.maxBytes {
		c.evictOneLocked()
	}
	c.data[key] = memoized
	c.keys = append(c.keys, key)
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
				if k, ok := key.(string); ok {
					c.cachedBytes -= len(k) + memoized.Size()
				}
			}
		},
	}
	return c
}

// Get impelments the Cache interface.
func (c *lruEvictedCache) Get(key string) (data Measurable, ok bool) {
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
func (c *lruEvictedCache) Add(key string, data Measurable) {
	memoized := memoizedMeasurable{m: data}
	if len(key)+memoized.Size() > c.maxBytes {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if v, ok := c.data.Get(lru.Key(key)); ok {
		if m, ok := v.(memoizedMeasurable); ok {
			c.cachedBytes -= len(key) + m.Size()
		}
	}
	c.cachedBytes += len(key) + memoized.Size()
	for c.cachedBytes > c.maxBytes {
		c.data.RemoveOldest()
	}
	c.data.Add(lru.Key(key), memoized)
}
