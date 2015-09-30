package libkb

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol"
	"stathat.com/c/ramcache"
)

type UserCache struct {
	cache *ramcache.Ramcache
}

func NewUserCache(maxAge time.Duration) *UserCache {
	res := &UserCache{
		cache: ramcache.New(),
	}
	res.cache.MaxAge = maxAge
	res.cache.TTL = maxAge
	return res
}

func (c *UserCache) Get(uid keybase1.UID) (*User, error) {
	v, err := c.cache.Get(string(uid))
	if err != nil {
		if err == ramcache.ErrNotFound {
			return nil, NotFoundError{}
		}
		return nil, err
	}
	u, ok := v.(*User)
	if !ok {
		return nil, fmt.Errorf("invalid type in cache: %T", v)
	}

	return u, nil
}

func (c *UserCache) Insert(u *User) error {
	return c.cache.Set(string(u.GetUID()), u)
}

func (c *UserCache) Shutdown() {
	c.cache.Shutdown()
}
