// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/hex"
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"stathat.com/c/ramcache"
)

type TrackCache struct {
	Contextified
	cache    *ramcache.Ramcache
	shutdown chan struct{}
}

func NewTrackCache(g *GlobalContext) *TrackCache {
	res := &TrackCache{
		Contextified: NewContextified(g),
		cache:        ramcache.New(),
		shutdown:     make(chan struct{}),
	}
	res.cache.TTL = 1 * time.Hour
	res.cache.MaxAge = 1 * time.Hour
	go res.periodicLog()
	return res
}

func (c *TrackCache) Get(key keybase1.TrackToken) (*IdentifyOutcome, error) {
	v, err := c.cache.Get(string(key))
	if err != nil {
		if err == ramcache.ErrNotFound {
			return nil, IdentifyTimeoutError{}
		}
		return nil, err
	}
	outcome, ok := v.(*IdentifyOutcome)
	if !ok {
		return nil, fmt.Errorf("invalid type in cache: %T", v)
	}
	return outcome, nil
}

func (c *TrackCache) Insert(outcome *IdentifyOutcome) (keybase1.TrackToken, error) {
	rb, err := RandBytes(16)
	if err != nil {
		return "", err
	}
	key := hex.EncodeToString(rb)
	if err := c.cache.Set(key, outcome); err != nil {
		return "", err
	}
	return keybase1.TrackToken(key), nil
}

func (c *TrackCache) Delete(key keybase1.TrackToken) error {
	return c.cache.Delete(string(key))
}

func (c *TrackCache) Shutdown() {
	c.cache.Shutdown()
	close(c.shutdown)
}

func (c *TrackCache) periodicLog() {
	for {
		select {
		case <-c.shutdown:
			return
		case <-time.After(time.Minute):
			c.G().Log.Debug("~~~ TrackCache num items in memory cache: %d", c.cache.Count())
		}
	}
}
