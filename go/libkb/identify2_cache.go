// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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
	Get(keybase1.UID, GetCheckTimeFunc, GetCacheDurationFunc, bool) (*keybase1.Identify2Res, error)
	Insert(up *keybase1.Identify2Res) error
	DidFullUserLoad(keybase1.UID)
	Shutdown()
	Delete(uid keybase1.UID) error
	UseDiskCache() bool
}

type GetCheckTimeFunc func(keybase1.Identify2Res) keybase1.Time
type GetCacheDurationFunc func(keybase1.Identify2Res) time.Duration

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
func (c *Identify2Cache) Get(uid keybase1.UID, gctf GetCheckTimeFunc, gcdf GetCacheDurationFunc, breaksOK bool) (*keybase1.Identify2Res, error) {
	v, err := c.cache.Get(string(uid))
	if err != nil {
		if err == ramcache.ErrNotFound {
			return nil, nil
		}
		return nil, err
	}
	up, ok := v.(*keybase1.Identify2Res)
	if !ok {
		return nil, fmt.Errorf("invalid type in cache: %T", v)
	}

	if gctf != nil {
		then := gctf(*up)
		if then == 0 {
			return nil, IdentifyTimeoutError{}
		}
		if up.TrackBreaks != nil && !breaksOK {
			return nil, TrackBrokenError{}
		}

		thenTime := keybase1.FromTime(then)
		timeout := gcdf(*up)
		if time.Since(thenTime) > timeout {
			return nil, IdentifyTimeoutError{}
		}
	}

	return up, nil
}

// Insert adds a user to the cache, keyed on UID.
func (c *Identify2Cache) Insert(up *keybase1.Identify2Res) error {
	tmp := *up
	copy := &tmp
	copy.Upk.Uvv.CachedAt = keybase1.ToTime(time.Now())
	return c.cache.Set(string(up.Upk.Uid), copy)
}

func (c *Identify2Cache) Delete(uid keybase1.UID) error {
	return c.cache.Delete(string(uid))
}

// Shutdown stops any goroutines in the cache.
func (c *Identify2Cache) Shutdown() {
	c.cache.Shutdown()
}

// DidFullUserLoad is a noop unless we're testing...
func (c *Identify2Cache) DidFullUserLoad(_ keybase1.UID) {}

func (c *Identify2Cache) UseDiskCache() bool { return true }
