package libkb

import (
	"bytes"
	"fmt"
	"sync"
	"time"

	humanize "github.com/dustin/go-humanize"
	lru "github.com/hashicorp/golang-lru"
	"github.com/syndtr/goleveldb/leveldb"
	"golang.org/x/net/context"
)

type DbCleanerConfig struct {
	MaxSize       uint64
	HaltSize      uint64
	CleanInterval time.Duration
	CacheCapacity int
}

const gb = 1024 * 1024 * 1024

var DefaultMobileDbCleanerConfig = DbCleanerConfig{
	MaxSize:       gb,
	HaltSize:      gb * .75,
	CleanInterval: time.Hour,
	CacheCapacity: 100000,
}

var DefaultDesktopDbCleanerConfig = DbCleanerConfig{
	MaxSize:       2 * gb,
	HaltSize:      1.5 * gb,
	CleanInterval: time.Hour,
	CacheCapacity: 100000,
}

// special key which marks out place when iterating through the db
const dbCleanerLastKey = "__lk"

func getDbSize(db *leveldb.DB) (uint64, error) {
	var stats leveldb.DBStats
	if err := db.Stats(&stats); err != nil {
		return 0, err
	}
	var totalSize int64
	for _, size := range stats.LevelSizes {
		totalSize += size
	}
	return uint64(totalSize), nil
}

type levelDbCleaner struct {
	Contextified
	sync.Mutex

	lastRun time.Time
	dbName  string
	config  DbCleanerConfig
	cache   *lru.Cache
	db      *leveldb.DB
	// testing
	forceClean bool
}

func newLevelDbCleaner(g *GlobalContext, dbName string) *levelDbCleaner {
	config := DefaultDesktopDbCleanerConfig
	if g.GetAppType() == MobileAppType {
		config = DefaultMobileDbCleanerConfig
	}
	cache, err := lru.New(config.CacheCapacity)
	if err != nil {
		panic(err)
	}
	return &levelDbCleaner{
		Contextified: NewContextified(g),
		// Start the run shortly after starting but not immediately
		lastRun: g.GetClock().Now().Add(-(config.CleanInterval - config.CleanInterval/10)),
		dbName:  dbName,
		config:  config,
		cache:   cache,
	}
}

func (c *levelDbCleaner) log(ctx context.Context, format string, args ...interface{}) {
	c.G().Log.CDebugf(ctx, fmt.Sprintf("levelDbCleaner(%s): %s", c.dbName, format), args...)
}

func (c *levelDbCleaner) setDb(db *leveldb.DB) {
	c.Lock()
	defer c.Unlock()
	c.db = db
}

func (c *levelDbCleaner) setForceClean(forceClean bool) {
	c.Lock()
	defer c.Unlock()
	c.forceClean = forceClean
}

func (c *levelDbCleaner) cacheKey(key []byte) string {
	return string(key)
}

func (c *levelDbCleaner) clearCache() {
	c.cache.Purge()
}

func (c *levelDbCleaner) getLastKey(ctx context.Context) []byte {
	value, found := c.cache.Get(dbCleanerLastKey)
	if !found {
		return nil
	}

	key, ok := value.([]byte)
	if !ok {
		return nil
	}
	return key
}

func (c *levelDbCleaner) clean(ctx context.Context) (err error) {
	c.Lock()
	defer c.Unlock()
	if !c.forceClean && c.G().GetClock().Now().Sub(c.lastRun) < c.config.CleanInterval {
		return nil
	}
	defer func() {
		if err == nil {
			c.lastRun = c.G().GetClock().Now()
		}
	}()
	defer c.G().CTraceTimed(ctx, fmt.Sprintf("levelDbCleaner(%s) clean", c.dbName), func() error { return err })()

	if c.db == nil {
		return nil
	}

	dbSize, err := getDbSize(c.db)
	if err != nil {
		return err
	}

	c.log(ctx, "size: %v, maxSize: %v, skipRun: %v",
		humanize.Bytes(dbSize), humanize.Bytes(c.config.MaxSize), dbSize < c.config.MaxSize)
	// check db size, abort if small enough
	if !c.forceClean && dbSize < c.config.MaxSize {
		return nil
	}

	key := c.getLastKey(ctx)
	for i := 0; i < 100; i++ {
		key, err = c.cleanBatch(ctx, key)
		if err != nil {
			return err
		}
		// check if we are within limits
		dbSize, err := getDbSize(c.db)
		if err != nil {
			return err
		}
		// check db size, abort if small enough
		if dbSize < c.config.HaltSize {
			break
		}

		time.Sleep(time.Millisecond * 500)
	}
	c.cache.Add(dbCleanerLastKey, key)
	return nil
}

func (c *levelDbCleaner) cleanBatch(ctx context.Context, startKey []byte) (nextKey []byte, err error) {
	iter := c.db.NewIterator(nil, nil)
	defer func() {
		// see if we have reached the end of the db, if so explicitly reset the nextKey value
		if !iter.Last() || bytes.Equal(nextKey, iter.Key()) {
			nextKey = nil
		}
		iter.Release()
		err = iter.Error()
	}()
	if startKey != nil {
		iter.Seek(startKey)
	}
	for i := 0; i < 100 && iter.Next(); i++ {
		// try to iterate over a small batch
		nextKey = iter.Key()
		if _, found := c.cache.Get(c.cacheKey(nextKey)); !found {
			c.db.Delete(nextKey, nil)
		} else {
			// clear out the value from the lru
			c.cache.Remove(c.cacheKey(nextKey))
		}
	}
	return nextKey, err
}

func (c *levelDbCleaner) attemptClean(ctx context.Context) {
	go func() {
		if err := c.clean(ctx); err != nil {
			c.log(ctx, "unable to clean: %v", err)
		}
	}()
}

func (c *levelDbCleaner) markRecentlyUsed(ctx context.Context, key []byte) {
	c.cache.Add(c.cacheKey(key), true)
	c.attemptClean(ctx)
}

func (c *levelDbCleaner) removeRecentlyUsed(ctx context.Context, key []byte) {
	c.cache.Remove(c.cacheKey(key))
	c.attemptClean(ctx)
}
