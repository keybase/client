// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"sync"
	"testing"
	"time"
)

func randChainLink() ChainLink {
	id, err := RandBytes(LinkIDLen)
	if err != nil {
		panic(err)
	}
	return ChainLink{
		id: LinkID(id),
	}
}

func TestLinkCacheBasics(t *testing.T) {
	c := NewLinkCache(10, time.Hour)
	defer c.Shutdown()

	link := randChainLink()

	// Dangerous, but as long as it works for now, go with it...
	var m MetaContext

	c.Put(m, link.id, link)

	if c.Len() != 1 {
		t.Errorf("c.cache len: %d, expected 1", c.Len())
	}

	_, ok := c.Get(link.id)
	if !ok {
		t.Errorf("Get failed after Put")
	}

	for i := 0; i < 50; i++ {
		nlink := randChainLink()
		c.Put(m, nlink.id, nlink)
	}

	if c.Len() != 51 {
		t.Errorf("c.cache len: %d, expected 51", c.Len())
	}

	c.Clean()

	if c.Len() != 10 {
		t.Errorf("c.cache len: %d, expected 10", c.Len())
	}

	// the first inserted link should be gone
	_, ok = c.Get(link.id)
	if ok {
		t.Errorf("expected first link to be gone")
	}
}

func TestLinkCacheAtime(t *testing.T) {
	c := NewLinkCache(10, time.Hour)
	defer c.Shutdown()

	// Dangerous, but as long as it works for now, go with it...
	var m MetaContext

	link := randChainLink()
	c.Put(m, link.id, link)

	if c.Len() != 1 {
		t.Errorf("c.cache len: %d, expected 1", c.Len())
	}

	_, ok := c.Get(link.id)
	if !ok {
		t.Errorf("Get failed after Put")
	}

	for i := 0; i < 50; i++ {
		nlink := randChainLink()
		c.Put(m, nlink.id, nlink)
	}

	// get the first inserted one to make it LRU
	_, ok = c.Get(link.id)
	if !ok {
		t.Errorf("Get failed after Put of 50")
	}

	if c.Len() != 51 {
		t.Errorf("c.cache len: %d, expected 51", c.Len())
	}

	c.Clean()

	if c.Len() != 10 {
		t.Errorf("c.cache len: %d, expected 10", c.Len())
	}

	// the first inserted link should still be there
	_, ok = c.Get(link.id)
	if !ok {
		t.Errorf("expected first link to be cached")
	}
}

// mainly useful when run with -race flag
func TestLinkCacheConcurrent(t *testing.T) {
	c := NewLinkCache(10, time.Hour)
	defer c.Shutdown()

	// Dangerous, but as long as it works for now, go with it...
	var m MetaContext

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			for x := 0; x < 100; x++ {
				link := randChainLink()
				c.Put(m, link.id, link)
				_, ok := c.Get(link.id)
				if !ok {
					t.Errorf("concurrent Get failed")
				}
			}
			wg.Done()
		}()
	}
	wg.Wait()
}

func TestLinkCacheShutdown(t *testing.T) {
	c := NewLinkCache(10, time.Hour)
	c.Shutdown()
	c.Shutdown()
}
