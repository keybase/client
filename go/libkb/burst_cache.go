package libkb

import (
	"fmt"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"golang.org/x/net/context"
)

// BurstCachce is an LRU+SingleFlighter useful for absorbing short-lived bursts
// of lookups. If multiple goroutines are fetching resource A, they all will block on
// the first fetch, and can (if the fetch returns without error) share the answer
// of the first request.
type BurstCache struct {
	Contextified
	locktab   *LockTable
	lru       *lru.Cache
	cacheLife time.Duration
	cacheName string
}

// BurstCacheKey is a key for a burst cache resource. Needs to implement the one
// method --- String() --- used for turning the key into an LRU and LockTab key.
type BurstCacheKey interface {
	String() string
}

// NewBurstCache makes a new burst cache with the given size and cacheLife.
// The cache will be at most cacheSize items long, and items will live in there for
// at most cacheLife duration. For debug logging purposes, this cache will be known
// as cacheName.
func NewBurstCache(g *GlobalContext, cacheSize int, cacheLife time.Duration, cacheName string) *BurstCache {
	lru, err := lru.New(cacheSize)
	if err != nil {
		g.Log.Fatalf("Bad LRU Constructor: %s", err.Error())
	}
	return &BurstCache{
		Contextified: NewContextified(g),
		lru:          lru,
		locktab:      NewLockTable(),
		cacheLife:    cacheLife,
		cacheName:    cacheName,
	}
}

type burstCacheObj struct {
	obj      interface{}
	cachedAt time.Time
}

// BurstCacherLoader is a function that loads an item (from network or whatnot).
// On success, its result will be cached into the burst cache. Maps a key
// to an object as an interface{}. The caller to Load() should wrap into the
// closure all parameters needed to actually fetch the object. They called
// Load(), so they likely have them handy.
type BurstCacheLoader func() (obj interface{}, err error)

// Load item key from the burst cache. On a cache miss, load with the given loader function.
// Return the object as an interface{}, so the caller needs to cast out of this burst cache.
func (b *BurstCache) Load(ctx context.Context, key BurstCacheKey, loader BurstCacheLoader) (ret interface{}, err error) {
	ctx = WithLogTag(ctx, "BC")

	defer b.G().CVTrace(ctx, VLog0, fmt.Sprintf("BurstCache(%s)#Load(%s)", b.cacheName, key.String()), func() error { return err })()

	lock := b.locktab.AcquireOnName(ctx, b.G(), key.String())
	defer lock.Release(ctx)

	b.G().VDL.CLogf(ctx, VLog0, "| past single-flight lock")

	found := false
	if val, ok := b.lru.Get(key.String()); ok {
		b.G().VDL.CLogf(ctx, VLog0, "| found in LRU cache")
		if tmp, ok := val.(*burstCacheObj); ok {
			age := b.G().GetClock().Now().Sub(tmp.cachedAt)
			if age < b.cacheLife {
				b.G().VDL.CLogf(ctx, VLog0, "| cached object was fresh (loaded %v ago)", age)
				ret = tmp.obj
				found = true
			} else {
				b.G().VDL.CLogf(ctx, VLog0, "| cached object expired %v ago", (age - b.cacheLife))
				b.lru.Remove(key.String())
			}
		} else {
			b.G().Log.CErrorf(ctx, "| object in LRU was of wrong type")
		}
	} else {
		b.G().VDL.CLogf(ctx, VLog0, "| object cache miss")
	}

	if !found {
		ret, err = loader()
		if err == nil {
			b.G().VDL.CLogf(ctx, VLog0, "| caching object after successful fetch")
			b.lru.Add(key.String(), &burstCacheObj{ret, b.G().GetClock().Now()})
		}
	}

	return ret, err
}
