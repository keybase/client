package storage

import "sync"

type ephemeralPurgeTrackerMemCache struct {
	sync.RWMutex
	info allPurgeInfo
}

func newPurgeCache() *ephemeralPurgeTrackerMemCache {
	return &ephemeralPurgeTrackerMemCache{}
}

func (c *ephemeralPurgeTrackerMemCache) Get() allPurgeInfo {
	c.RLock()
	defer c.RUnlock()
	return c.info
}

func (c *ephemeralPurgeTrackerMemCache) Put(info allPurgeInfo) {
	c.Lock()
	defer c.Unlock()
	c.info = info
}

func (c *ephemeralPurgeTrackerMemCache) OnLogout() error {
	c.Lock()
	defer c.Unlock()
	c.info = nil
	return nil
}

var ephemeralPurgeCache = newPurgeCache()
