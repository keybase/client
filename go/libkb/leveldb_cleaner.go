package libkb

import (
	"bytes"
	"fmt"
	"sync"
	"time"

	humanize "github.com/dustin/go-humanize"
	lru "github.com/hashicorp/golang-lru"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/util"
	"golang.org/x/net/context"
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
	// On mobile we only run when in the BACKGROUNDACTIVE mode, this is limited
	// to ~10s of runtime by the OS, we don't want to sleep if we need to get a
	// clean done.
	SleepInterval: 0,
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

	running  bool
	lastKey  []byte
	lastRun  time.Time
	dbName   string
	config   DbCleanerConfig
	cache    *lru.Cache
	isMobile bool
	db       *leveldb.DB
	stopCh   chan struct{}
	cancelCh chan struct{}
}

func newLevelDbCleaner(mctx MetaContext, dbName string) *levelDbCleaner {
	config := DefaultDesktopDbCleanerConfig
	isMobile := mctx.G().IsMobileAppType()
	if isMobile {
		config = DefaultMobileDbCleanerConfig
	}
	return newLevelDbCleanerWithConfig(mctx, dbName, config, isMobile)
}

func newLevelDbCleanerWithConfig(mctx MetaContext, dbName string, config DbCleanerConfig, isMobile bool) *levelDbCleaner {
	cache, err := lru.New(config.CacheCapacity)
	if err != nil {
		panic(err)
	}
	mctx = mctx.WithLogTag("DBCLN")
	c := &levelDbCleaner{
		MetaContextified: NewMetaContextified(mctx),
		// Start the run shortly after starting but not immediately
		lastRun:  mctx.G().GetClock().Now().Add(-(config.CleanInterval - config.CleanInterval/10)),
		dbName:   dbName,
		config:   config,
		cache:    cache,
		isMobile: isMobile,
		stopCh:   make(chan struct{}),
		cancelCh: make(chan struct{}),
	}
	if isMobile {
		go c.monitorAppState()
	}
	return c
}

func (c *levelDbCleaner) Status() string {
	return fmt.Sprintf("levelDbCleaner{cacheSize: %d, lastRun: %v, lastKey: %v, running: %v}\n%v\n",
		c.cache.Len(), c.lastRun, c.lastKey, c.running, c.config)
}

func (c *levelDbCleaner) Stop() {
	c.log("Stop")
	c.Lock()
	defer c.Unlock()
	if c.stopCh != nil {
		close(c.stopCh)
		c.stopCh = make(chan struct{})
	}
}

func (c *levelDbCleaner) monitorAppState() {
	c.log("monitorAppState")
	state := keybase1.MobileAppState_FOREGROUND
	for {
		select {
		case state = <-c.G().MobileAppState.NextUpdate(&state):
			switch state {
			case keybase1.MobileAppState_BACKGROUNDACTIVE:
				c.log("monitorAppState: attempting clean")
				c.clean(false)
			default:
				c.log("monitorAppState: attempting cancel, state: %v", state)
				c.Lock()
				if c.cancelCh != nil {
					close(c.cancelCh)
					c.cancelCh = make(chan struct{})
				}
				c.Unlock()
			}
		case <-c.stopCh:
			c.log("monitorAppState: stop")
			return
		}
	}
}

func (c *levelDbCleaner) log(format string, args ...interface{}) {
	c.M().Debug(fmt.Sprintf("levelDbCleaner(%s): %s", c.dbName, format), args...)
}

func (c *levelDbCleaner) setDb(db *leveldb.DB) {
	c.Lock()
	defer c.Unlock()
	c.db = db
}

func (c *levelDbCleaner) cacheKey(key []byte) string {
	return string(key)
}

func (c *levelDbCleaner) clearCache() {
	c.cache.Purge()
}

func (c *levelDbCleaner) shouldCleanLocked(force bool) bool {
	if c.running {
		return false
	}
	if force {
		return true
	}
	validCache := c.cache.Len() >= c.config.MinCacheSize
	if c.isMobile {
		return validCache && c.G().MobileAppState.State() == keybase1.MobileAppState_BACKGROUNDACTIVE
	}
	return validCache &&
		c.G().GetClock().Now().Sub(c.lastRun) >= c.config.CleanInterval
}

func (c *levelDbCleaner) getDbSize() (size uint64, err error) {
	if c.db == nil {
		return 0, nil
	}
	// get the size from the start of the kv table to the beginning of the perm
	// table since that is all we can clean
	dbRange := util.Range{Start: tablePrefix(levelDbTableKv), Limit: tablePrefix(levelDbTablePerm)}
	sizes, err := c.db.SizeOf([]util.Range{dbRange})
	if err != nil {
		return 0, err
	}
	return uint64(sizes.Sum()), nil
}

func (c *levelDbCleaner) clean(force bool) (err error) {
	c.Lock()
	// get out without spamming the logs
	if !c.shouldCleanLocked(force) {
		c.Unlock()
		return nil
	}
	c.running = true
	key := c.lastKey
	c.Unlock()

	defer c.M().TraceTimed(fmt.Sprintf("levelDbCleaner(%s) clean, config: %v", c.dbName, c.config), func() error { return err })()
	defer func() {
		c.Lock()
		defer c.Unlock()
		c.lastKey = key
		c.lastRun = c.G().GetClock().Now()
		c.running = false
	}()

	dbSize, err := c.getDbSize()
	if err != nil {
		return err
	}

	c.log("dbSize: %v, cacheSize: %v",
		humanize.Bytes(dbSize), c.cache.Len())
	// check db size, abort if small enough
	if !force && dbSize < c.config.MaxSize {
		return nil
	}

	var totalNumPurged, numPurged int
	for i := 0; i < 100; i++ {
		select {
		case <-c.cancelCh:
			c.log("aborting clean, %d runs, canceled", i)
			return nil
		case <-c.stopCh:
			c.log("aborting clean %d runs, stopped", i)
			return nil
		default:
		}

		start := c.G().GetClock().Now()
		numPurged, key, err = c.cleanBatch(key)
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
		dbSize, err = c.getDbSize()
		if err != nil {
			return err
		}
		// check db size, abort if small enough
		if !force && dbSize < c.config.HaltSize {
			break
		}
		time.Sleep(c.config.SleepInterval)
	}
	c.log("clean complete. purged %d items total, dbSize: %v", totalNumPurged, humanize.Bytes(dbSize))
	return nil
}

func (c *levelDbCleaner) cleanBatch(startKey []byte) (int, []byte, error) {
	// Start our range from wherever we left off last time, and clean up until
	// the permanent entries table begins.
	iterRange := &util.Range{Start: startKey, Limit: tablePrefix(levelDbTablePerm)}
	// Option suggested in
	// https://github.com/google/leveldb/blob/master/doc/index.md#cache
	// """When performing a bulk read, the application may wish to disable
	// caching so that the data processed by the bulk read does not end up
	// displacing most of the cached contents."""
	opts := &opt.ReadOptions{DontFillCache: true}
	iter := c.db.NewIterator(iterRange, opts)
	batch := new(leveldb.Batch)
	for batch.Len() < 1000 && iter.Next() {
		key := iter.Key()
		if _, found := c.cache.Get(c.cacheKey(key)); !found {
			cp := make([]byte, len(key))
			copy(cp, key)
			batch.Delete(cp)
		} else {
			// clear out the value from the lru
			c.cache.Remove(c.cacheKey(key))
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
	if err := c.db.Write(batch, nil); err != nil {
		return 0, nil, err
	}
	// Compact the range we just deleted in so the size changes are reflected
	err := c.db.CompactRange(util.Range{Start: startKey, Limit: key})
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
	c.cache.Add(c.cacheKey(key), true)
	c.attemptClean(ctx)
}

func (c *levelDbCleaner) removeRecentlyUsed(ctx context.Context, key []byte) {
	c.cache.Remove(c.cacheKey(key))
	c.attemptClean(ctx)
}
