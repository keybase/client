package libkb

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	humanize "github.com/dustin/go-humanize"
	lru "github.com/hashicorp/golang-lru"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/util"
)

type DbCleanerConfig struct {
	// start cleaning if above this size
	MaxSize uint64
	// stop cleaning when below this size
	HaltSize uint64
	// attempt a clean with this frequency
	CleanInterval time.Duration
	// number of keys to keep cached
	CacheCapacity int
	// number of keys cached to run a clean
	MinCacheSize int
	// duration cleaner sleeps when cleaning
	SleepInterval time.Duration
}

func (c DbCleanerConfig) String() string {
	return fmt.Sprintf("DbCleanerConfig{MaxSize: %v, HaltSize: %v, CleanInterval: %v, CacheCapacity: %v, MinCacheSize: %v, SleepInterval: %v}",
		humanize.Bytes(c.MaxSize), humanize.Bytes(c.HaltSize),
		c.CleanInterval, c.CacheCapacity,
		c.MinCacheSize, c.SleepInterval)
}

var DefaultMobileDbCleanerConfig = DbCleanerConfig{
	MaxSize:       opt.GiB,
	HaltSize:      opt.GiB * .75,
	CleanInterval: time.Hour,
	CacheCapacity: 100000,
	MinCacheSize:  10000,
	SleepInterval: 10 * time.Millisecond,
}

var DefaultDesktopDbCleanerConfig = DbCleanerConfig{
	MaxSize:       2 * opt.GiB,
	HaltSize:      1.5 * opt.GiB,
	CleanInterval: time.Hour,
	CacheCapacity: 100000,
	MinCacheSize:  10000,
	SleepInterval: 50 * time.Millisecond,
}

type levelDbCleaner struct {
	MetaContextified
	sync.Mutex

	running bool
	lastKey []byte
	lastRun time.Time
	dbName  string
	config  DbCleanerConfig
	cache   *lru.Cache
	cacheMu sync.Mutex // protects the pointer to the cache
	db      *leveldb.DB
	stopCh  chan struct{}
	// cleanDone is closed when the running clean exits.
	cleanDone chan struct{}
}

func newLevelDbCleaner(mctx MetaContext, dbName string) *levelDbCleaner {
	config := DefaultDesktopDbCleanerConfig
	if mctx.G().IsMobileAppType() {
		config = DefaultMobileDbCleanerConfig
	}
	return newLevelDbCleanerWithConfig(mctx, dbName, config)
}

func newLevelDbCleanerWithConfig(mctx MetaContext, dbName string, config DbCleanerConfig) *levelDbCleaner {
	cache, err := lru.New(config.CacheCapacity)
	if err != nil {
		panic(err)
	}
	mctx = mctx.WithLogTag("DBCLN")
	return &levelDbCleaner{
		MetaContextified: NewMetaContextified(mctx),
		// Start the run shortly after starting but not immediately
		lastRun: mctx.G().GetClock().Now().Add(-(config.CleanInterval - config.CleanInterval/10)),
		dbName:  dbName,
		config:  config,
		cache:   cache,
		stopCh:  make(chan struct{}),
	}
}

func (c *levelDbCleaner) getCache() *lru.Cache {
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	return c.cache
}

func (c *levelDbCleaner) Status() string {
	cacheSize := c.getCache().Len()
	c.Lock()
	defer c.Unlock()
	return fmt.Sprintf("levelDbCleaner{cacheSize: %d, lastRun: %v, lastKey: %v, running: %v}\n%v\n",
		cacheSize, c.lastRun, c.lastKey, c.running, c.config)
}

// Stop detaches the cleaner from its db and waits for a running clean to
// exit, so the caller can close the db without an iterator still open on it.
func (c *levelDbCleaner) Stop() {
	c.log("Stop")
	c.Lock()
	close(c.stopCh)
	c.stopCh = make(chan struct{})
	c.db = nil
	var cleanDone chan struct{}
	if c.running {
		cleanDone = c.cleanDone
	}
	c.Unlock()
	if cleanDone != nil {
		<-cleanDone
	}
}

// forgetPosition restarts cleaning from the first key, for when the db's
// contents are gone.
func (c *levelDbCleaner) forgetPosition() {
	c.Lock()
	defer c.Unlock()
	c.lastKey = nil
}

// start attaches the cleaner to a newly opened db, undoing a previous
// Stop/Shutdown from closing it.
func (c *levelDbCleaner) start(db *leveldb.DB) {
	cache, err := lru.New(c.config.CacheCapacity)
	if err != nil {
		panic(err)
	}
	c.Lock()
	defer c.Unlock()
	c.db = db
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	c.cache = cache
}

func (c *levelDbCleaner) log(format string, args ...any) {
	c.M().Debug(fmt.Sprintf("levelDbCleaner(%s): %s", c.dbName, format), args...)
}

func (c *levelDbCleaner) cacheKey(key []byte) string {
	return string(key)
}

func (c *levelDbCleaner) clearCache() {
	c.getCache().Purge()
}

func (c *levelDbCleaner) Shutdown() {
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	c.cache, _ = lru.New(1)
}

func (c *levelDbCleaner) shouldCleanLocked(force bool) bool {
	if c.running {
		return false
	}
	if force {
		return true
	}
	validCache := c.getCache().Len() >= c.config.MinCacheSize
	return validCache &&
		c.G().GetClock().Now().Sub(c.lastRun) >= c.config.CleanInterval
}

func (c *levelDbCleaner) getDbSize(db *leveldb.DB) (size uint64, err error) {
	// get the size from the start of the kv table to the beginning of the perm
	// table since that is all we can clean
	dbRange := util.Range{Start: tablePrefix(levelDbTableKv), Limit: tablePrefix(levelDbTablePerm)}
	sizes, err := db.SizeOf([]util.Range{dbRange})
	if err != nil {
		return 0, err
	}
	return uint64(sizes.Sum()), nil //nolint:gosec // G115: Database size is non-negative, safe to convert
}

func (c *levelDbCleaner) clean(force bool) (err error) {
	c.Lock()
	// get out without spamming the logs
	if c.db == nil || !c.shouldCleanLocked(force) {
		c.Unlock()
		return nil
	}
	c.running = true
	cleanDone := make(chan struct{})
	c.cleanDone = cleanDone
	// A clean stays on the db it started with. Before that db is closed, Stop
	// closes stopCh and waits for the clean to exit; a reopen attaches a new
	// db for later cleans without this one ever touching it.
	db := c.db
	key := c.lastKey
	stopCh := c.stopCh
	// Sample the app state in the same critical section as running=true, so
	// a transition that lands between here and the batch loop (during
	// getDbSize, logging, etc.) is not missed: any caller who observes
	// running via c.Lock() only does so after this sample is already taken.
	// A clean gives way to the foreground: it keeps running only while the
	// app state stays BACKGROUNDACTIVE (or never changes at all, as on
	// desktop). NextUpdate collapses intermediate transitions, so a wake
	// re-reads the current state rather than assuming what it changed to.
	state := c.G().MobileAppState.State()
	appCh := c.G().MobileAppState.NextUpdate(state)
	c.Unlock()

	defer c.M().Trace(fmt.Sprintf("levelDbCleaner(%s) clean, config: %v", c.dbName, c.config), &err)()
	defer func() {
		c.Lock()
		defer c.Unlock()
		if c.db == db {
			c.lastKey = key
		}
		c.lastRun = c.G().GetClock().Now()
		c.running = false
		close(cleanDone)
	}()

	dbSize, err := c.getDbSize(db)
	if err != nil {
		return err
	}

	c.log("dbSize: %v, cacheSize: %v",
		humanize.Bytes(dbSize), c.getCache().Len())
	// check db size, abort if small enough
	if !force && dbSize < c.config.MaxSize {
		return nil
	}

	var totalNumPurged, numPurged int
	for i := range 100 {
		select {
		case <-stopCh:
			c.log("aborting clean %d runs, stopped", i)
			return nil
		case <-appCh:
			state = c.G().MobileAppState.State()
			if state != keybase1.MobileAppState_BACKGROUNDACTIVE {
				c.log("aborting clean, %d runs, left BACKGROUNDACTIVE for %v", i, state)
				return nil
			}
			appCh = c.G().MobileAppState.NextUpdate(state)
		default:
		}

		start := c.G().GetClock().Now()
		numPurged, key, err = c.cleanBatch(db, stopCh, key)
		if err == errCleanStopped {
			c.log("aborting clean %d runs, stopped", i)
			return nil
		}
		if err != nil {
			return err
		}
		if numPurged == 0 {
			break
		}
		totalNumPurged += numPurged

		if i%10 == 0 {
			c.log("purged %d items, dbSize: %v, lastKey:%s, ran in: %v",
				numPurged, humanize.Bytes(dbSize), key, c.G().GetClock().Now().Sub(start))
		}
		// check if we are within limits
		dbSize, err = c.getDbSize(db)
		if err != nil {
			return err
		}
		// check db size, abort if small enough
		if !force && dbSize < c.config.HaltSize {
			break
		}
		select {
		case <-stopCh:
			c.log("aborting clean %d runs, stopped", i)
			return nil
		case <-time.After(c.config.SleepInterval):
		}
	}
	c.log("clean complete. purged %d items total, dbSize: %v", totalNumPurged, humanize.Bytes(dbSize))
	return nil
}

var errCleanStopped = errors.New("levelDbCleaner: stopped")

func (c *levelDbCleaner) cleanBatch(db *leveldb.DB, stopCh chan struct{}, startKey []byte) (int, []byte, error) {
	// Start our range from wherever we left off last time, and clean up until
	// the permanent entries table begins.
	iterRange := &util.Range{Start: startKey, Limit: tablePrefix(levelDbTablePerm)}
	// Option suggested in
	// https://github.com/google/leveldb/blob/master/doc/index.md#cache
	// """When performing a bulk read, the application may wish to disable
	// caching so that the data processed by the bulk read does not end up
	// displacing most of the cached contents."""
	opts := &opt.ReadOptions{DontFillCache: true}
	iter := db.NewIterator(iterRange, opts)
	batch := new(leveldb.Batch)
	for batch.Len() < 1000 && iter.Next() {
		key := iter.Key()

		select {
		case <-stopCh:
			iter.Release()
			return 0, startKey, errCleanStopped
		default:
		}
		cache := c.getCache()

		if _, found := cache.Get(c.cacheKey(key)); !found {
			cp := make([]byte, len(key))
			copy(cp, key)
			batch.Delete(cp)
		} else {
			// clear out the value from the lru
			cache.Remove(c.cacheKey(key))
		}
	}
	key := make([]byte, len(iter.Key()))
	copy(key, iter.Key())
	// see if we have reached the end of the db, if so explicitly reset the
	// key value
	iter.Last()
	if bytes.Equal(key, iter.Key()) {
		key = nil
	}
	iter.Release()
	if err := iter.Error(); err != nil {
		return 0, nil, err
	}
	if err := db.Write(batch, nil); err != nil {
		return 0, nil, err
	}
	// Compact the range we just deleted in so the size changes are reflected
	err := db.CompactRange(util.Range{Start: startKey, Limit: key})
	return batch.Len(), key, err
}

func (c *levelDbCleaner) attemptClean(ctx context.Context) {
	go func() {
		if err := c.clean(false /*force */); err != nil {
			c.log("unable to clean: %v", err)
		}
	}()
}

func (c *levelDbCleaner) markRecentlyUsed(ctx context.Context, key []byte) {
	c.getCache().Add(c.cacheKey(key), true)
	c.attemptClean(ctx)
}

func (c *levelDbCleaner) removeRecentlyUsed(ctx context.Context, key []byte) {
	c.getCache().Remove(c.cacheKey(key))
	c.attemptClean(ctx)
}
