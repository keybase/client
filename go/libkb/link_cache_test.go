// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
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

	require.Equal(t, 1, c.Len(), "c.cache len: %d, expected 1", c.Len())

	_, ok := c.Get(link.id)
	require.True(t, ok, "Get failed after Put")

	for range 50 {
		nlink := randChainLink()
		c.Put(m, nlink.id, nlink)
	}

	require.Equal(t, 51, c.Len(), "c.cache len: %d, expected 51", c.Len())

	c.Clean()

	require.Equal(t, 10, c.Len(), "c.cache len: %d, expected 10", c.Len())

	// the first inserted link should be gone
	_, ok = c.Get(link.id)
	require.False(t, ok, "expected first link to be gone")
}

func TestLinkCacheAtime(t *testing.T) {
	c := NewLinkCache(10, time.Hour)
	defer c.Shutdown()

	// Dangerous, but as long as it works for now, go with it...
	var m MetaContext

	link := randChainLink()
	c.Put(m, link.id, link)

	require.Equal(t, 1, c.Len(), "c.cache len: %d, expected 1", c.Len())

	_, ok := c.Get(link.id)
	require.True(t, ok, "Get failed after Put")

	for range 50 {
		nlink := randChainLink()
		c.Put(m, nlink.id, nlink)
	}

	// get the first inserted one to make it LRU
	_, ok = c.Get(link.id)
	require.True(t, ok, "Get failed after Put of 50")

	require.Equal(t, 51, c.Len(), "c.cache len: %d, expected 51", c.Len())

	c.Clean()

	require.Equal(t, 10, c.Len(), "c.cache len: %d, expected 10", c.Len())

	// the first inserted link should still be there
	_, ok = c.Get(link.id)
	require.True(t, ok, "expected first link to be cached")
}

// mainly useful when run with -race flag
func TestLinkCacheConcurrent(t *testing.T) {
	c := NewLinkCache(10, time.Hour)
	defer c.Shutdown()

	// Dangerous, but as long as it works for now, go with it...
	var m MetaContext

	var wg sync.WaitGroup
	for range 10 {
		wg.Add(1)
		go func() {
			for range 100 {
				link := randChainLink()
				c.Put(m, link.id, link)
				_, ok := c.Get(link.id)
				require.True(t, ok, "concurrent Get failed")
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
