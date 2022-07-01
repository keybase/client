package unfurl

import (
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
)

const defaultCacheLifetime = 10 * time.Minute
const defaultCacheSize = 1000

type cacheItem struct {
	data  interface{}
	ctime gregor1.Time
}

type unfurlCache struct {
	sync.Mutex
	cache *lru.Cache
	clock clockwork.Clock
}

func newUnfurlCache() *unfurlCache {
	cache, err := lru.New(defaultCacheSize)
	if err != nil {
		panic(err)
	}
	return &unfurlCache{
		cache: cache,
		clock: clockwork.NewRealClock(),
	}
}

func (c *unfurlCache) setClock(clock clockwork.Clock) {
	c.clock = clock
}

// get determines if the item is in the cache and newer than 10
// minutes. We don't want to cache this value indefinitely in case the page
// content changes.
func (c *unfurlCache) get(key string) (res cacheItem, ok bool) {
	c.Lock()
	defer c.Unlock()

	item, ok := c.cache.Get(key)
	if !ok {
		return res, false
	}
	cacheItem, ok := item.(cacheItem)
	if !ok {
		return res, false
	}
	valid := c.clock.Now().Sub(cacheItem.ctime.Time()) <= defaultCacheLifetime
	if !valid {
		c.cache.Remove(key)
	}
	return cacheItem, valid
}

func (c *unfurlCache) put(key string, data interface{}) {
	c.Lock()
	defer c.Unlock()
	c.cache.Add(key, cacheItem{
		data:  data,
		ctime: gregor1.ToTime(c.clock.Now()),
	})
}
