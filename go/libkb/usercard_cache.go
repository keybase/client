package libkb

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"

	"stathat.com/c/ramcache"
)

// UserCardCache caches keybase1.UserCard objects in memory.
type UserCardCache struct {
	cache *ramcache.Ramcache
}

// NewUserCardCache creates a UserCardCache.  keybase1.UserCards will expire
// after maxAge.
func NewUserCardCache(maxAge time.Duration) *UserCardCache {
	c := &UserCardCache{
		cache: ramcache.New(),
	}
	c.cache.MaxAge = maxAge
	c.cache.TTL = maxAge
	return c
}

// Get looks for a keybase1.UserCard for uid.  It returns nil, nil if not found.
// useSession is set if the card is being looked up with a session.
func (c *UserCardCache) Get(uid keybase1.UID, useSession bool) (*keybase1.UserCard, error) {
	v, err := c.cache.Get(c.key(uid, useSession))
	if err != nil {
		if err == ramcache.ErrNotFound {
			return nil, nil
		}
		return nil, err
	}
	card, ok := v.(keybase1.UserCard)
	if !ok {
		return nil, fmt.Errorf("invalid type in cache: %T", v)
	}
	return &card, nil
}

// Set stores card in the UserCardCache.  usedSession is set based on
// whether user/card was looked up with a session or not.
func (c *UserCardCache) Set(card *keybase1.UserCard, usedSession bool) error {
	return c.cache.Set(c.key(card.Uid, usedSession), *card)
}

// Shutdown stops any goroutines in the cache.
func (c *UserCardCache) Shutdown() {
	c.cache.Shutdown()
}

func (c *UserCardCache) key(uid keybase1.UID, session bool) string {
	suffix := "0"
	if session {
		suffix = "1"
	}
	return uid.String() + ":" + suffix
}
