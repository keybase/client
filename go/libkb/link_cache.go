// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

type linkIDFixed [LinkIDLen]byte

// LinkCache is a cache of ChainLinks.
// It is safe to use concurrently.
type LinkCache struct {
	cache map[linkIDFixed]ChainLink
	gets  chan getLinkReq
	puts  chan putLinkReq
	dels  chan delLinkReq
	done  chan struct{}
}

// NewLinkCache creates a LinkCache. When finished using this
// LinkCache, call Shutdown on it to clean up the goroutine.
func NewLinkCache() *LinkCache {
	c := &LinkCache{
		cache: make(map[linkIDFixed]ChainLink),
		gets:  make(chan getLinkReq),
		puts:  make(chan putLinkReq),
		dels:  make(chan delLinkReq),
		done:  make(chan struct{}),
	}

	go c.handle()

	return c
}

// Get retrieves a list of ChainLinks from the cache. If nothing
// exists for this uid, it will return false for ok.
func (c *LinkCache) Get(id LinkID) (link ChainLink, ok bool) {
	req := getLinkReq{
		result: make(chan getLinkRes),
	}
	copy(req.linkID[:], id)
	c.gets <- req

	res := <-req.result
	return res.link, res.ok
}

// Put inserts a list of ChainLinks into the cache.
func (c *LinkCache) Put(id LinkID, link ChainLink) {
	req := putLinkReq{
		link: link,
	}
	copy(req.linkID[:], id)
	c.puts <- req
}

// Remove deletes a list of ChainLinks from the cache.
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
		case <-c.done:
			return
		}
	}
}
