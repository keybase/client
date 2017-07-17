// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"container/list"
	"fmt"
	"time"
)

type linkIDFixed [LinkIDLen]byte

// LinkCache is a cache of ChainLinks.
// It is safe to use concurrently.
type LinkCache struct {
	cache  map[linkIDFixed]*list.Element
	gets   chan getLinkReq
	puts   chan putLinkReq
	dels   chan delLinkReq
	muts   chan mutLinkReq
	lens   chan lenReq
	cleans chan struct{}
	done   chan struct{}

	cleanWait time.Duration
	maxSize   int

	accessOrder *list.List
}

// NewLinkCache creates a LinkCache. When finished using this
// LinkCache, call Shutdown on it to clean up.
func NewLinkCache(maxSize int, cleanDur time.Duration) *LinkCache {
	c := &LinkCache{
		cache:       make(map[linkIDFixed]*list.Element),
		gets:        make(chan getLinkReq),
		puts:        make(chan putLinkReq),
		dels:        make(chan delLinkReq),
		lens:        make(chan lenReq),
		cleans:      make(chan struct{}),
		done:        make(chan struct{}),
		muts:        make(chan mutLinkReq),
		maxSize:     maxSize,
		cleanWait:   cleanDur,
		accessOrder: list.New(),
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

func (c *LinkCache) Mutate(id LinkID, f func(c *ChainLink)) {
	req := mutLinkReq{
		f: f,
	}
	copy(req.linkID[:], id)
	c.muts <- req
}

// Remove deletes a ChainLink from the cache.
func (c *LinkCache) Remove(id LinkID) {
	var req delLinkReq
	copy(req.linkID[:], id)
	c.dels <- req
}

// Len returns the number of ChainLinks cached.
func (c *LinkCache) Len() int {
	req := lenReq{
		result: make(chan int),
	}
	c.lens <- req
	return <-req.result
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

type mutLinkReq struct {
	linkID linkIDFixed
	f      func(c *ChainLink)
}

type lenReq struct {
	result chan int
}

func (c *LinkCache) handle() {
	for {
		select {
		case g := <-c.gets:
			elt, ok := c.cache[g.linkID]
			if ok {
				link, ok := elt.Value.(ChainLink)
				if !ok {
					panic(fmt.Sprintf("invalid type in cache: %T", elt))
				}
				// move the element to the back (most recently accessed)
				c.accessOrder.MoveToBack(elt)
				g.result <- getLinkRes{link: link.Copy(), ok: true}
			} else {
				g.result <- getLinkRes{ok: false}
			}
		case p := <-c.puts:
			elt, ok := c.cache[p.linkID]
			if ok {
				// if this link already exists, remove it from
				// the accessOrder list.
				c.accessOrder.Remove(elt)
			}
			elt = c.accessOrder.PushBack(p.link)
			c.cache[p.linkID] = elt
		case d := <-c.dels:
			elt, ok := c.cache[d.linkID]
			if ok {
				c.accessOrder.Remove(elt)
			}
			delete(c.cache, d.linkID)
		case l := <-c.lens:
			l.result <- len(c.cache)
		case m := <-c.muts:
			if elt, ok := c.cache[m.linkID]; ok {
				if link, ok := elt.Value.(ChainLink); ok {
					m.f(&link)
					c.accessOrder.Remove(elt)
					elt = c.accessOrder.PushBack(link)
					c.cache[m.linkID] = elt
				}
			}
		case <-c.cleans:
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
