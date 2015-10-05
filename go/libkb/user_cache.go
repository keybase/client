package libkb

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol"
	"stathat.com/c/ramcache"
)

// UserCache stores User objects in memory for a fixed amount of
// time.
type UserCache struct {
	cache *ramcache.Ramcache
}

// NewUserCache creates a UserCache and sets the object max age to
// maxAge.  Once a user is inserted, after maxAge duration passes,
// the user will be removed from the cache.
func NewUserCache(maxAge time.Duration) *UserCache {
	res := &UserCache{
		cache: ramcache.New(),
	}
	res.cache.MaxAge = maxAge
	res.cache.TTL = maxAge
	return res
}

// Get returns a user object.  If none exists for uid, it will
// return NotFoundError.
func (c *UserCache) Get(uid keybase1.UID) (*keybase1.UserPlusKeys, error) {
	v, err := c.cache.Get(string(uid))
	if err != nil {
		if err == ramcache.ErrNotFound {
			return nil, NotFoundError{}
		}
		return nil, err
	}
	up, ok := v.(*keybase1.UserPlusKeys)
	if !ok {
		return nil, fmt.Errorf("invalid type in cache: %T", v)
	}

	return up, nil
}

// Insert adds a user to the cache, keyed on UID.
func (c *UserCache) Insert(up *keybase1.UserPlusKeys) error {
	return c.cache.Set(string(up.Uid), up)
}

// Shutdown stops any goroutines in the cache.
func (c *UserCache) Shutdown() {
	c.cache.Shutdown()
}
