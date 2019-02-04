// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"container/list"
	"fmt"
	"sync"
	"time"
)

type linkIDFixed [LinkIDLen]byte

// LinkCache is a cache of ChainLinks.
// It is safe to use concurrently.
type LinkCache struct {
	sync.Mutex

	cache        map[linkIDFixed]*list.Element
	done         chan struct{}
	shutdownOnce sync.Once

	cleanWait time.Duration
	maxSize   int

	accessOrder *list.List
}

// NewLinkCache creates a LinkCache. When finished using this
// LinkCache, call Shutdown on it to clean up.
func NewLinkCache(maxSize int, cleanDur time.Duration) *LinkCache {
	c := &LinkCache{
		cache:       make(map[linkIDFixed]*list.Element),
		done:        make(chan struct{}),
		maxSize:     maxSize,
		cleanWait:   cleanDur,
		accessOrder: list.New(),
	}
	go c.periodic()
	return c
}

// Get retrieves a ChainLink from the cache. If nothing
// exists for this LinkID, it will return false for ok.
func (c *LinkCache) Get(id LinkID) (link ChainLink, ok bool) {
	c.Lock()
	defer c.Unlock()
	var linkID linkIDFixed
	copy(linkID[:], id)
	elt, ok := c.cache[linkID]
	if ok {
		link, ok := elt.Value.(ChainLink)
		if !ok {
			panic(fmt.Sprintf("invalid type in cache: %T", elt))
		}
		// move the element to the back (most recently accessed)
		c.accessOrder.MoveToBack(elt)
		return link.Copy(), true
	}
	return link, false
}

func (c *LinkCache) Put(m MetaContext, id LinkID, link ChainLink) {
	c.Lock()
	defer c.Unlock()
	var linkID linkIDFixed
	copy(linkID[:], id)

	elt, ok := c.cache[linkID]
	if ok {
		// if this link already exists, remove it from
		// the accessOrder list.
		c.accessOrder.Remove(elt)
	}
	elt = c.accessOrder.PushBack(link)
	c.cache[linkID] = elt
}

func (c *LinkCache) Mutate(id LinkID, f func(c *ChainLink)) {
	c.Lock()
	defer c.Unlock()
	var linkID linkIDFixed
	copy(linkID[:], id)
	if elt, ok := c.cache[linkID]; ok {
		if link, ok := elt.Value.(ChainLink); ok {
			f(&link)
			c.accessOrder.Remove(elt)
			elt = c.accessOrder.PushBack(link)
			c.cache[linkID] = elt
		}
	}
}

// Remove deletes a ChainLink from the cache.
func (c *LinkCache) Remove(id LinkID) {
	c.Lock()
	defer c.Unlock()
	var linkID linkIDFixed
	copy(linkID[:], id)
	elt, ok := c.cache[linkID]
	if ok {
		c.accessOrder.Remove(elt)
	}
	delete(c.cache, linkID)
}

// Len returns the number of ChainLinks cached.
func (c *LinkCache) Len() int {
	c.Lock()
	defer c.Unlock()
	return len(c.cache)
}

// Shutdown terminates the use of this cache.
func (c *LinkCache) Shutdown() {
	c.shutdownOnce.Do(func() { close(c.done) })
}

func (c *LinkCache) Clean() {
	c.Lock()
	defer c.Unlock()
	delta := len(c.cache) - c.maxSize
	for i := 0; i < delta; i++ {
		// get the least recently used element
		oldest := c.accessOrder.Front()

		// get a fixed link id from it
		link, ok := oldest.Value.(ChainLink)
		if !ok {
			panic(fmt.Sprintf("invalid type in cache: %T", oldest))
		}
		var linkID linkIDFixed
		copy(linkID[:], link.id)

		// remove the oldest element
		c.accessOrder.Remove(oldest)

		// and remove the ChainLink from the cache
		delete(c.cache, linkID)
	}
}

func (c *LinkCache) periodic() {
	for {
		select {
		case <-c.done:
			return
		case <-time.After(c.cleanWait):
			c.Clean()
		}
	}
}
