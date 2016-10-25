// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package utils

import (
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/protocol/keybase1"
)

type udCacheKey struct {
	UID        keybase1.UID
	WithDevice bool
	DeviceID   keybase1.DeviceID
}

type udCacheValue struct {
	Username   string
	DeviceName string
}

// UserDeviceCache looks up usernames and device names, memoizing the results.
// These bindings are immutable and can be cached forever.
type UserDeviceCache struct {
	sync.Mutex
	cache *lru.Cache
	kbCtx KeybaseContext
}

func NewUserDeviceCache(kbCtx KeybaseContext) *UserDeviceCache {
	udc, _ := lru.New(10000)
	return &UserDeviceCache{
		cache: udc,
		kbCtx: kbCtx,
	}
}

type udFiller func() (udCacheValue, error)

// Lookup an entry in the cache. Call filler to fill it if it misses.
func (c *UserDeviceCache) lookup(cKey udCacheKey, filler udFiller) (udCacheValue, error) {
	c.Lock()
	defer c.Unlock()

	if val, ok := c.cache.Get(cKey); ok {
		if udval, ok := val.(udCacheValue); ok {
			c.kbCtx.GetLog().Debug("UserDeviceCache hit: u: %s d: %s", udval.Username, udval.DeviceName)
			return udval, nil
		}
	}

	cVal, err := filler()
	if err != nil {
		return cVal, err
	}
	c.cache.Add(cKey, cVal)
	return cVal, nil
}

func (c *UserDeviceCache) LookupUsernameAndDeviceName(uimap *UserInfoMapper, uid keybase1.UID, deviceID keybase1.DeviceID) (username string, devicename string, err error) {
	cKey := udCacheKey{
		UID:        uid,
		WithDevice: true,
		DeviceID:   deviceID,
	}
	val, err := c.lookup(cKey, func() (udCacheValue, error) {
		username, deviceName, err := uimap.Lookup(uid, deviceID)
		return udCacheValue{
			Username:   username,
			DeviceName: deviceName,
		}, err
	})
	return val.Username, val.DeviceName, err
}

func (c *UserDeviceCache) LookupUsername(uimap *UserInfoMapper, uid keybase1.UID) (username string, err error) {
	cKey := udCacheKey{
		UID:        uid,
		WithDevice: false,
	}
	val, err := c.lookup(cKey, func() (udCacheValue, error) {
		user, err := uimap.User(uid)
		if err != nil {
			return udCacheValue{}, err
		}
		return udCacheValue{
			Username: user.GetNormalizedName().String(),
		}, nil
	})
	return val.Username, err
}
