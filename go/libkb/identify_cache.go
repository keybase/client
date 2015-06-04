package libkb

import (
	"fmt"
	"time"

	"stathat.com/c/ramcache"
)

type IdentifyCache struct {
	cache *ramcache.Ramcache
}

func NewIdentifyCache() *IdentifyCache {
	res := &IdentifyCache{
		cache: ramcache.New(),
	}
	res.cache.TTL = 10 * time.Minute
	res.cache.MaxAge = 10 * time.Minute
	return res
}

func (c *IdentifyCache) Get(key string) (*IdentifyOutcome, error) {
	v, err := c.cache.Get(key)
	if err != nil {
		return nil, err
	}
	outcome, ok := v.(*IdentifyOutcome)
	if !ok {
		return nil, fmt.Errorf("invalid type in cache: %T", v)
	}
	return outcome, nil
}

func (c *IdentifyCache) Set(key string, outcome *IdentifyOutcome) error {
	return c.cache.Set(key, outcome)
}

func (c *IdentifyCache) Delete(key string) error {
	return c.cache.Delete(key)
}

func (c *IdentifyCache) Clear() {
}
