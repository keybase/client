// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol"
)

// ChainCache is a cache of ChainLink lists for a user. It is
// used to preload the links for a user during a LoadUser
// operation. It is safe to use concurrently.
type ChainCache struct {
	cache map[keybase1.UID][]ChainLink
	gets  chan getChainReq
	puts  chan putChainReq
	dels  chan delChainReq
	done  chan struct{}
}

// NewChainCache creates a ChainCache. When finished using this
// ChainCache, call Shutdown on it to clean up the goroutine.
func NewChainCache() *ChainCache {
	c := &ChainCache{
		cache: make(map[keybase1.UID][]ChainLink),
		gets:  make(chan getChainReq),
		puts:  make(chan putChainReq),
		dels:  make(chan delChainReq),
		done:  make(chan struct{}),
	}

	go c.handle()

	return c
}

// Get retrieves a list of ChainLinks from the cache. If nothing
// exists for this uid, it will return false for ok.
func (c *ChainCache) Get(uid keybase1.UID) (links []ChainLink, ok bool) {
	req := getChainReq{
		UID:    uid,
		Result: make(chan getChainRes),
	}
	c.gets <- req

	res := <-req.Result
	return res.Links, res.Ok
}

// Put inserts a list of ChainLinks into the cache.
func (c *ChainCache) Put(uid keybase1.UID, links []ChainLink) {
	req := putChainReq{
		UID:   uid,
		Links: links,
	}

	c.puts <- req
}

// Remove deletes a list of ChainLinks from the cache.
func (c *ChainCache) Remove(uid keybase1.UID) {
	req := delChainReq{
		UID: uid,
	}

	c.dels <- req
}

// Shutdown terminates the use of this cache.
func (c *ChainCache) Shutdown() {
	close(c.done)
}

type getChainReq struct {
	UID    keybase1.UID
	Result chan getChainRes
}

type getChainRes struct {
	Links []ChainLink
	Ok    bool
}

type putChainReq struct {
	UID   keybase1.UID
	Links []ChainLink
}

type delChainReq struct {
	UID keybase1.UID
}

func (c *ChainCache) handle() {
	for {
		select {
		case g := <-c.gets:
			var res getChainRes
			res.Links, res.Ok = c.cache[g.UID]
			g.Result <- res
		case p := <-c.puts:
			c.cache[p.UID] = p.Links
		case d := <-c.dels:
			delete(c.cache, d.UID)
		case <-c.done:
			return
		}
	}
}
