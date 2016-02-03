// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "time"

type linkIDFixed [LinkIDLen]byte

// LinkCache is a cache of ChainLinks.
// It is safe to use concurrently.
type LinkCache struct {
	cache  map[linkIDFixed]ChainLink
	gets   chan getLinkReq
	puts   chan putLinkReq
	dels   chan delLinkReq
	cleans chan struct{}
	done   chan struct{}

	cleanWait time.Duration
	maxSize   int
}

// NewLinkCache creates a LinkCache. When finished using this
// LinkCache, call Shutdown on it to clean up.
func NewLinkCache(maxSize int, cleanDur time.Duration) *LinkCache {
	c := &LinkCache{
		cache:     make(map[linkIDFixed]ChainLink),
		gets:      make(chan getLinkReq),
		puts:      make(chan putLinkReq),
		dels:      make(chan delLinkReq),
		cleans:    make(chan struct{}),
		done:      make(chan struct{}),
		maxSize:   maxSize,
		cleanWait: cleanDur,
	}

	go c.handle()
	go c.periodic()

	return c
}

// Get retrieves a ChainLink from the cache. If nothing
// exists for this LinkID, it will return false for ok.
func (c *LinkCache) Get(id LinkID) (link ChainLink, ok bool) {
	req := getLinkReq{
		result: make(chan getLinkRes),
	}
	copy(req.linkID[:], id)
	c.gets <- req

	res := <-req.result
	return res.link, res.ok
}

// Put inserts a ChainLink into the cache.
func (c *LinkCache) Put(id LinkID, link ChainLink) {
	req := putLinkReq{
		link: link,
	}
	copy(req.linkID[:], id)
	c.puts <- req
}

// Remove deletes a ChainLink from the cache.
func (c *LinkCache) Remove(id LinkID) {
	var req delLinkReq
	copy(req.linkID[:], id)
	c.dels <- req
}

// Shutdown terminates the use of this cache.
func (c *LinkCache) Shutdown() {
	close(c.done)
}

type getLinkReq struct {
	linkID linkIDFixed
	result chan getLinkRes
}

type getLinkRes struct {
	link ChainLink
	ok   bool
}

type putLinkReq struct {
	linkID linkIDFixed
	link   ChainLink
}

type delLinkReq struct {
	linkID linkIDFixed
}

func (c *LinkCache) handle() {
	for {
		select {
		case g := <-c.gets:
			link, ok := c.cache[g.linkID]
			if ok {
				g.result <- getLinkRes{link: link.Copy(), ok: true}
			} else {
				g.result <- getLinkRes{ok: false}
			}
		case p := <-c.puts:
			c.cache[p.linkID] = p.link
		case d := <-c.dels:
			delete(c.cache, d.linkID)
		case <-c.cleans:
			delta := len(c.cache) - c.maxSize
			if delta <= 0 {
				continue
			}
			// delete random entries from cache
			for k := range c.cache {
				delete(c.cache, k)
				delta--
				if delta == 0 {
					break
				}
			}
		case <-c.done:
			return
		}
	}
}

func (c *LinkCache) periodic() {
	for {
		select {
		case <-c.done:
			return
		case <-time.After(c.cleanWait):
			c.cleans <- struct{}{}
		}
	}
}
