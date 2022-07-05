package stellar

import (
	"fmt"
	"reflect"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
)

// Threadsafe cache with expiration and singleflighting.
type TimeCache struct {
	name    string // name for logging
	maxAge  time.Duration
	lockTab *libkb.LockTable
	cache   *lru.Cache
}

type timeCacheEntry struct {
	val  interface{}
	time time.Time
}

func NewTimeCache(name string, size int, maxAge time.Duration) *TimeCache {
	if size <= 0 {
		size = 10
	}
	cache, err := lru.New(size)
	if err != nil {
		panic(err)
	}
	return &TimeCache{
		name:    name,
		maxAge:  maxAge,
		cache:   cache,
		lockTab: libkb.NewLockTable(),
	}
}

type cacheFillFunc = func() (interface{}, error)

func (c *TimeCache) Get(mctx libkb.MetaContext, key string, into interface{}) (ok bool) {
	return c.getHelper(mctx, key, into, nil) == nil
}

// GetWithFill is prefereable to Get because it holds a locktab lock during the fill.
// Which prevents concurrent accesses from doing the extra work of running fill at the same time.
func (c *TimeCache) GetWithFill(mctx libkb.MetaContext, key string, into interface{}, fill cacheFillFunc) error {
	return c.getHelper(mctx, key, into, fill)
}

func (c *TimeCache) getHelper(mctx libkb.MetaContext, key string, into interface{}, fill cacheFillFunc) error {
	lock, err := c.lockTab.AcquireOnNameWithContextAndTimeout(mctx.Ctx(), mctx.G(), key, time.Minute)
	if err != nil {
		return fmt.Errorf("could not acquire cache lock for key %v", key)
	}
	defer lock.Release(mctx.Ctx())
	if val, ok := c.cache.Get(key); ok {
		if entry, ok := val.(timeCacheEntry); ok {
			if c.maxAge <= 0 || mctx.G().GetClock().Now().Sub(entry.time) <= c.maxAge {
				// Cache hit
				mctx.Debug("TimeCache %v cache hit", c.name)
				if c.storeResult(entry.val, into) {
					return nil
				}
				mctx.Debug("TimeCache %v target does not match", c.name)
			}
		} else {
			// Would indicate a bug in TimeCache.
			mctx.Debug("TimeCache %v bad cached type: %T", c.name, val)
		}
		// Remove the expired or corrupt entry.
		c.cache.Remove(key)
	}
	if fill != nil {
		val, err := fill()
		if err != nil {
			return err
		}
		c.Put(mctx, key, val)
		if c.storeResult(val, into) {
			return nil
		}
		return fmt.Errorf("value cannot be stored")
	}
	return fmt.Errorf("value not found for '%v'", key)
}

func (c *TimeCache) storeResult(val interface{}, into interface{}) (ok bool) {
	target := reflect.Indirect(reflect.ValueOf(into))
	if target.CanSet() && reflect.TypeOf(val).AssignableTo(reflect.TypeOf(target.Interface())) {
		target.Set(reflect.ValueOf(val))
		return true
	}
	// Would indicate the caller used the wrong types.
	return false
}

func (c *TimeCache) Put(mctx libkb.MetaContext, key string, val interface{}) {
	c.cache.Add(key, timeCacheEntry{
		val:  val,
		time: time.Now().Round(0),
	})
}

func (c *TimeCache) Clear() {
	c.cache.Purge()
}
