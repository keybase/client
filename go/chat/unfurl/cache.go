package unfurl

import (
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
)

const (
	defaultCacheLifetime = 10 * time.Minute
	defaultCacheSize     = 1000

	// suppressedCacheLifetime/Size bound the store of per-send unfurl
	// suppressions: a message about to send holds at most a handful of
	// dismissed URLs, and the entry is only relevant for as long as the
	// send is in flight, so a small cap and a short TTL are enough to
	// prevent an unconsumed entry (failed/aborted send) from leaking for
	// the life of the process.
	suppressedCacheLifetime = 5 * time.Minute
	suppressedCacheSize     = 200
)

type cacheItem struct {
	data  any
	ctime gregor1.Time
}

type unfurlCache struct {
	sync.Mutex
	cache    *lru.Cache
	clock    clockwork.Clock
	lifetime time.Duration
}

func newUnfurlCache() *unfurlCache {
	return newUnfurlCacheWithLimits(defaultCacheSize, defaultCacheLifetime)
}

func newUnfurlCacheWithLimits(size int, lifetime time.Duration) *unfurlCache {
	cache, err := lru.New(size)
	if err != nil {
		panic(err)
	}
	return &unfurlCache{
		cache:    cache,
		clock:    clockwork.NewRealClock(),
		lifetime: lifetime,
	}
}

func (c *unfurlCache) setClock(clock clockwork.Clock) {
	c.clock = clock
}

// get determines if the item is in the cache and newer than the cache's
// lifetime. We don't want to cache this value indefinitely in case the page
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
	valid := c.clock.Now().Sub(cacheItem.ctime.Time()) <= c.lifetime
	if !valid {
		c.cache.Remove(key)
	}
	return cacheItem, valid
}

func (c *unfurlCache) put(key string, data any) {
	c.Lock()
	defer c.Unlock()
	c.cache.Add(key, cacheItem{
		data:  data,
		ctime: gregor1.ToTime(c.clock.Now()),
	})
}
