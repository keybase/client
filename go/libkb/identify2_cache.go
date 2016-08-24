// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"stathat.com/c/ramcache"
)

// Identify2Cache stores User objects in memory for a fixed amount of
// time.
type Identify2Cache struct {
	cache *ramcache.Ramcache
}

type Identify2Cacher interface {
	Get(keybase1.UID, GetCheckTimeFunc, time.Duration) (*keybase1.UserPlusKeys, error)
	Insert(up *keybase1.UserPlusKeys) error
	Shutdown()
}

type GetCheckTimeFunc func(keybase1.UserPlusKeys) keybase1.Time

// NewIdentify2Cache creates a Identify2Cache and sets the object max age to
// maxAge.  Once a user is inserted, after maxAge duration passes,
// the user will be removed from the cache.
func NewIdentify2Cache(maxAge time.Duration) *Identify2Cache {
	res := &Identify2Cache{
		cache: ramcache.New(),
	}
	res.cache.MaxAge = maxAge
	res.cache.TTL = maxAge
	return res
}

// Get returns a user object.  If none exists for uid, it will return nil.
func (c *Identify2Cache) Get(uid keybase1.UID, gctf GetCheckTimeFunc, timeout time.Duration) (*keybase1.UserPlusKeys, error) {
	v, err := c.cache.Get(string(uid))
	if err != nil {
		if err == ramcache.ErrNotFound {
			return nil, nil
		}
		return nil, err
	}
	up, ok := v.(*keybase1.UserPlusKeys)
	if !ok {
		return nil, fmt.Errorf("invalid type in cache: %T", v)
	}

	if gctf != nil {
		then := gctf(*up)
		if then == 0 {
			return nil, TimeoutError{}
		}

		thenTime := keybase1.FromTime(then)
		if time.Since(thenTime) > timeout {
			return nil, TimeoutError{}
		}
	}

	return up, nil
}

// Insert adds a user to the cache, keyed on UID.
func (c *Identify2Cache) Insert(up *keybase1.UserPlusKeys) error {
	tmp := *up
	copy := &tmp
	copy.Uvv.CachedAt = keybase1.ToTime(time.Now())
	return c.cache.Set(string(up.Uid), copy)
}

// Shutdown stops any goroutines in the cache.
func (c *Identify2Cache) Shutdown() {
	c.cache.Shutdown()
}
