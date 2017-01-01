// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type udCacheKey struct {
	UID        keybase1.UID
	WithDevice bool
	DeviceID   keybase1.DeviceID
}

type udCacheValue struct {
	Username   string
	DeviceName string
	DeviceType string
}

// UserDeviceCache looks up usernames and device names, memoizing the results.
// These bindings are immutable and can be cached forever.
type UserDeviceCache struct {
	sync.Mutex
	Contextified
	cache *lru.Cache
}

func NewUserDeviceCache(g *GlobalContext) *UserDeviceCache {
	udc, _ := lru.New(10000)
	return &UserDeviceCache{
		Contextified: NewContextified(g),
		cache:        udc,
	}
}

type udFiller func() (udCacheValue, error)

// Lookup an entry in the cache. Call filler to fill it if it misses.
func (c *UserDeviceCache) lookup(cKey udCacheKey, filler udFiller) (udCacheValue, error) {
	c.Lock()
	defer c.Unlock()

	if val, ok := c.cache.Get(cKey); ok {
		if udval, ok := val.(udCacheValue); ok {
			c.G().Log.Debug("UserDeviceCache hit: u: %v d: %v", udval.Username, udval.DeviceName)
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

// LookupUsernameAndDevice first checks the cache and then falls through to the CachedUserLoader.
func (c *UserDeviceCache) LookupUsernameAndDevice(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (username string, deviceName string, deviceType string, err error) {
	cKey := udCacheKey{
		UID:        uid,
		WithDevice: true,
		DeviceID:   deviceID,
	}
	c.G().Log.CDebugf(ctx, "+ UserDeviceCache#LookupUsernameAndDevice(%v, %v)", uid, deviceID)
	val, err := c.lookup(cKey, func() (udCacheValue, error) {
		upakLoader := c.G().GetUPAKLoader()
		if upakLoader == nil {
			return udCacheValue{}, fmt.Errorf("no CachedUserLoader available in context")
		}

		un, deviceName, deviceType, err := upakLoader.LookupUsernameAndDevice(ctx, uid, deviceID)
		if err != nil {
			return udCacheValue{}, err
		}
		return udCacheValue{
			Username:   un.String(),
			DeviceName: deviceName,
			DeviceType: deviceType,
		}, err
	})
	c.G().Log.Debug("- UserDeviceCache#LookupUsernameAndDevice(%v, %v) -> (%v, %v, %v, %v)", uid, deviceID, val.Username, val.DeviceName, val.DeviceType, err)
	return val.Username, val.DeviceName, val.DeviceType, err
}

// LookupUsername first checks the cache and then falls through to the CachedUserLoader.
func (c *UserDeviceCache) LookupUsername(ctx context.Context, uid keybase1.UID) (username string, err error) {
	cKey := udCacheKey{
		UID:        uid,
		WithDevice: false,
	}
	c.G().Log.CDebugf(ctx, "+ UserDeviceCache#LookupUsername(%v)", uid)
	val, err := c.lookup(cKey, func() (udCacheValue, error) {
		upakLoader := c.G().GetUPAKLoader()
		if upakLoader == nil {
			return udCacheValue{}, fmt.Errorf("no CachedUserLoader available in context")
		}
		un, err := upakLoader.LookupUsername(ctx, uid)
		if err != nil {
			return udCacheValue{}, err
		}

		return udCacheValue{
			Username: un.String(),
		}, nil
	})
	c.G().Log.Debug("- UserDeviceCache#LookupUsername(%v) -> (%v, %v)", uid, val.Username, err)
	return val.Username, err
}
