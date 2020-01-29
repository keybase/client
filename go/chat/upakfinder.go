package chat

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type udStoredRes struct {
	username               libkb.NormalizedUsername
	deviceName, deviceType string
}

type checkKidStoredRes struct {
	found     bool
	revokedAt *keybase1.KeybaseTime
	deleted   bool
}

type CachingUPAKFinder struct {
	globals.Contextified
	utils.DebugLabeler

	udLock        sync.RWMutex
	udCache       map[string]udStoredRes
	checkKidLock  sync.RWMutex
	checkKidCache map[string]checkKidStoredRes
}

func NewCachingUPAKFinder(g *globals.Context) *CachingUPAKFinder {
	return &CachingUPAKFinder{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.GetLog(), "CachingUPAKFinder", false),
		udCache:       make(map[string]udStoredRes),
		checkKidCache: make(map[string]checkKidStoredRes),
	}
}

func (u *CachingUPAKFinder) udKey(uid keybase1.UID, deviceID keybase1.DeviceID) string {
	return fmt.Sprintf("ud:%s:%s", uid, deviceID)
}

func (u *CachingUPAKFinder) checkKidKey(uid keybase1.UID, kid keybase1.KID) string {
	return fmt.Sprintf("ck:%s:%s", uid, kid)
}

func (u *CachingUPAKFinder) lookupUDKey(key string) (udStoredRes, bool) {
	u.udLock.RLock()
	defer u.udLock.RUnlock()
	existing, ok := u.udCache[key]
	return existing, ok
}

func (u *CachingUPAKFinder) writeUDKey(key string, username libkb.NormalizedUsername, deviceName, deviceType string) {
	u.udLock.Lock()
	defer u.udLock.Unlock()
	u.udCache[key] = udStoredRes{
		username:   username,
		deviceName: deviceName,
		deviceType: deviceType,
	}
}

func (u *CachingUPAKFinder) lookupCheckKidKey(key string) (checkKidStoredRes, bool) {
	u.checkKidLock.RLock()
	defer u.checkKidLock.RUnlock()
	existing, ok := u.checkKidCache[key]
	return existing, ok
}

func (u *CachingUPAKFinder) writeCheckKidKey(key string, found bool, revokedAt *keybase1.KeybaseTime,
	deleted bool) {
	u.checkKidLock.Lock()
	defer u.checkKidLock.Unlock()
	u.checkKidCache[key] = checkKidStoredRes{
		found:     found,
		revokedAt: revokedAt,
		deleted:   deleted,
	}
}

func (u *CachingUPAKFinder) LookupUsernameAndDevice(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (username libkb.NormalizedUsername, deviceName string, deviceType string, err error) {
	key := u.udKey(uid, deviceID)
	existing, ok := u.lookupUDKey(key)
	if ok {
		return existing.username, existing.deviceName, existing.deviceType, nil
	}
	defer func() {
		if err == nil {
			u.writeUDKey(key, username, deviceName, deviceType)
		}
	}()
	return u.G().GetUPAKLoader().LookupUsernameAndDevice(ctx, uid, deviceID)
}

func (u *CachingUPAKFinder) CheckKIDForUID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, deleted bool, err error) {
	key := u.checkKidKey(uid, kid)
	existing, ok := u.lookupCheckKidKey(key)
	if ok {
		return existing.found, existing.revokedAt, existing.deleted, nil
	}
	defer func() {
		if err == nil {
			u.writeCheckKidKey(key, found, revokedAt, deleted)
		}
	}()
	return u.G().GetUPAKLoader().CheckKIDForUID(ctx, uid, kid)
}
