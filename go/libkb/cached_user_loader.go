package libkb

import (
	"errors"
	"fmt"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CachedUserLoader struct {
	sync.Mutex
	Contextified
	m         map[string]*keybase1.UserPlusAllKeys
	locktab   LockTable
	Freshness time.Duration
}

func NewCachedUserLoader(g *GlobalContext, f time.Duration) *CachedUserLoader {
	return &CachedUserLoader{
		Contextified: NewContextified(g),
		m:            make(map[string]*keybase1.UserPlusAllKeys),
		Freshness:    f,
	}
}

func culDBKey(uid keybase1.UID) DbKey {
	return DbKeyUID(DBUserPlusAllKeys, uid)
}

func (u *CachedUserLoader) ClearMemory() {
	u.Lock()
	defer u.Unlock()
	u.m = make(map[string]*keybase1.UserPlusAllKeys)
}

func (u *CachedUserLoader) getCachedUPK(uid keybase1.UID, info *CachedUserLoadInfo) (*keybase1.UserPlusAllKeys, bool) {
	u.Lock()
	upk := u.m[uid.String()]
	u.Unlock()

	// Try loading from persistent storage if we missed memory cache.
	if upk != nil {
		u.G().Log.Debug("| hit memory cache")
		if info != nil {
			info.InCache = true
		}
	} else {
		var tmp keybase1.UserPlusAllKeys
		found, err := u.G().LocalDb.GetInto(&tmp, culDBKey(uid))
		if err != nil {
			u.G().Log.Warning("trouble accessing UserPlusAllKeys cache: %s", err)
		} else if !found {
			u.G().Log.Debug("| missed disk cache")
		} else {
			u.G().Log.Debug("| hit disk cache")
			upk = &tmp
			if info != nil {
				info.InDiskCache = true
			}
			// Insert disk object into memory.
			u.Lock()
			u.m[uid.String()] = upk
			u.Unlock()
		}
	}

	if upk == nil {
		u.G().Log.Debug("| missed cache")
		return nil, true
	}
	fresh := false
	if u.Freshness == time.Duration(0) {
		u.G().Log.Debug("| cache miss since cache disabled")
	} else {
		diff := u.G().Clock().Now().Sub(keybase1.FromTime(upk.Base.Uvv.CachedAt))
		fresh = (diff <= u.Freshness)
		if fresh {
			u.G().Log.Debug("| cache hit was fresh (cached %s ago)", diff)
		} else {
			u.G().Log.Debug("| cache hit was stale (by %s)", u.Freshness-diff)
		}
	}
	return upk, fresh
}

type CachedUserLoadInfo struct {
	InCache      bool
	InDiskCache  bool
	TimedOut     bool
	StaleVersion bool
	LoadedLeaf   bool
	LoadedUser   bool
}

func (u *CachedUserLoader) Disable() {
	u.Freshness = time.Duration(0)
}

func culDebug(u keybase1.UID) string {
	return fmt.Sprintf("CachedUserLoader#Load(%s)", u)
}

func (u *CachedUserLoader) extractDeviceKey(upk *keybase1.UserPlusAllKeys, deviceID keybase1.DeviceID) (deviceKey *keybase1.PublicKey, revoked *keybase1.RevokedKey, err error) {
	for i := range upk.Base.RevokedDeviceKeys {
		r := &upk.Base.RevokedDeviceKeys[i]
		pk := &r.Key
		if pk.DeviceID == deviceID {
			deviceKey = pk
			revoked = r
		}
	}
	for i := range upk.Base.DeviceKeys {
		pk := &upk.Base.DeviceKeys[i]
		if pk.DeviceID == deviceID {
			deviceKey = pk
			revoked = nil
		}
	}

	if deviceKey == nil {
		dkey := fmt.Sprintf("%s:%s", upk.Base.Uid, deviceID)
		return nil, nil, fmt.Errorf("device not found for %s", dkey)
	}

	return deviceKey, revoked, nil
}

func (u *CachedUserLoader) putUPKToCache(obj *keybase1.UserPlusAllKeys) error {
	uid := obj.Base.Uid
	u.G().Log.Debug("| %s: Caching: %+v", culDebug(uid), *obj)
	u.Lock()
	u.m[uid.String()] = obj
	u.Unlock()
	err := u.G().LocalDb.PutObj(culDBKey(uid), nil, *obj)
	if err != nil {
		u.G().Log.Warning("Error in writing UPAK for %s: %s", uid, err)
	}
	return err
}

// loadWithInfo loads a user by UID from the CachedUserLoader object. The 'info'
// object contains information about how the request was handled, but otherwise,
// this method behaves like (and implements) the public CachedUserLoader#Load
// method below.
func (u *CachedUserLoader) loadWithInfo(arg LoadUserArg, info *CachedUserLoadInfo) (ret *keybase1.UserPlusAllKeys, user *User, err error) {
	defer u.G().Trace(culDebug(arg.UID), func() error { return err })()

	if arg.UID.IsNil() {
		err = errors.New("need a UID to load UPK from loader")
		return nil, nil, err
	}

	lock := u.locktab.AcquireOnName(arg.UID.String())
	defer lock.Release()

	var upk *keybase1.UserPlusAllKeys
	var fresh bool

	if !arg.ForceReload {
		upk, fresh = u.getCachedUPK(arg.UID, info)
	}
	if arg.ForcePoll {
		fresh = false
	}

	if upk != nil {
		u.G().Log.Debug("%s: cache-hit; fresh=%v", culDebug(arg.UID), fresh)
		if fresh || arg.StaleOK {
			return upk.DeepCopy(), nil, nil
		}
		if info != nil {
			info.TimedOut = true
		}

		var sigHints *SigHints
		sigHints, err = LoadSigHints(arg.UID, u.G())
		if err != nil {
			return nil, nil, err
		}

		var leaf *MerkleUserLeaf
		leaf, err = lookupMerkleLeaf(u.G(), arg.UID, true, sigHints)
		if err != nil {
			return nil, nil, err
		}
		if info != nil {
			info.LoadedLeaf = true
		}
		if leaf.public != nil && leaf.public.Seqno == Seqno(upk.Base.Uvv.SigChain) {
			u.G().Log.Debug("%s: cache-hit; fresh after poll", culDebug(arg.UID), fresh)

			upk.Base.Uvv.CachedAt = keybase1.ToTime(u.G().Clock().Now())
			// This is only necessary to update the levelDB representation,
			// since the previous line updates the in-memory cache satisfactorially.
			u.putUPKToCache(upk)

			return upk.DeepCopy(), nil, nil
		}

		if info != nil {
			info.StaleVersion = true
		}
		arg.SigHints = sigHints
		arg.MerkleLeaf = leaf
	}

	u.G().Log.Debug("%s: LoadUser", culDebug(arg.UID))
	user, err = LoadUser(arg)
	if info != nil {
		info.LoadedUser = true
	}

	// In some cases, it's OK to have a user object and an error. This comes up in
	// Identify2 when identifying users who don't have a sigchain. Note that we'll never
	// hit the cache in this case (for now...)
	if err != nil {
		return nil, user, err
	}

	if user == nil {
		return nil, nil, UserNotFoundError{UID: arg.UID, Msg: "LoadUser failed"}
	}

	tmp := user.ExportToUserPlusAllKeys(keybase1.Time(0))
	ret = &tmp
	ret.Base.Uvv.CachedAt = keybase1.ToTime(u.G().Clock().Now())
	err = u.putUPKToCache(ret)

	return ret, user, nil
}

// Load a UserPlusAllKeys from the local cache, falls back to LoadUser, and cache the user.
// Can only perform lookups by UID. Will return a non-nil UserPlusAllKeys, or a non-nil error,
// but never both non-nil, nor never both nil. If we had to do a full LoadUser as part of the
// request, it's returned too.
func (u *CachedUserLoader) Load(arg LoadUserArg) (ret *keybase1.UserPlusAllKeys, user *User, err error) {
	return u.loadWithInfo(arg, nil)
}

func (u *CachedUserLoader) CheckKIDForUID(uid keybase1.UID, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, err error) {

	var info CachedUserLoadInfo
	upk, _, err := u.loadWithInfo(NewLoadUserByUIDArg(u.G(), uid), &info)

	if err != nil {
		return false, nil, err
	}
	found, revokedAt = CheckKID(upk, kid)
	if found || info.LoadedLeaf || info.LoadedUser {
		return found, revokedAt, nil
	}
	upk, _, err = u.loadWithInfo(NewLoadUserByUIDForceArg(u.G(), uid), nil)
	if err != nil {
		return false, nil, err
	}
	found, revokedAt = CheckKID(upk, kid)
	return found, revokedAt, nil
}

func (u *CachedUserLoader) LoadUserPlusKeys(uid keybase1.UID) (keybase1.UserPlusKeys, error) {
	var up keybase1.UserPlusKeys
	if uid.IsNil() {
		return up, NoUIDError{}
	}

	arg := NewLoadUserArg(u.G())
	arg.UID = uid
	arg.PublicKeyOptional = true

	// We need to force a reload to make KBFS tests pass
	arg.ForcePoll = true

	upak, _, err := u.Load(arg)
	if err != nil {
		return up, err
	}
	if upak == nil {
		return up, fmt.Errorf("Nil user, nil error from LoadUser")
	}
	up = upak.Base
	return up, nil
}

func (u *CachedUserLoader) Invalidate(uid keybase1.UID) {
	u.Lock()
	defer u.Unlock()
	u.G().Log.Debug("CachedUserLoader#Invalidate(%s)", uid)
	delete(u.m, uid.String())
}

// Load the PublicKey for a user's device from the local cache, falling back to LoadUser, and cache the user.
// If the user exists but the device doesn't, will force a load in case the device is very new.
func (u *CachedUserLoader) LoadDeviceKey(uid keybase1.UID, deviceID keybase1.DeviceID) (upk *keybase1.UserPlusAllKeys, deviceKey *keybase1.PublicKey, revoked *keybase1.RevokedKey, err error) {
	var info CachedUserLoadInfo
	upk, _, err = u.loadWithInfo(NewLoadUserByUIDArg(u.G(), uid), &info)
	if err != nil {
		return nil, nil, nil, err
	}

	deviceKey, revoked, err = u.extractDeviceKey(upk, deviceID)
	if err == nil {
		// Early success, return
		return upk, deviceKey, revoked, err
	}

	// Try again with a forced load in case the device is very new.
	upk, _, err = u.loadWithInfo(NewLoadUserByUIDForceArg(u.G(), uid), nil)
	if err != nil {
		return nil, nil, nil, err
	}

	deviceKey, revoked, err = u.extractDeviceKey(upk, deviceID)
	return upk, deviceKey, revoked, err
}

func (u *CachedUserLoader) LookupUsername(uid keybase1.UID) NormalizedUsername {
	var info CachedUserLoadInfo
	arg := NewLoadUserByUIDArg(u.G(), uid)
	arg.StaleOK = true
	upk, _, _ := u.loadWithInfo(arg, &info)
	return NewNormalizedUsername(upk.Base.Username)
}

func (u *CachedUserLoader) lookupUsernameAndDeviceWithInfo(uid keybase1.UID, did keybase1.DeviceID, info *CachedUserLoadInfo) (username NormalizedUsername, deviceName string, deviceType string, err error) {
	arg := NewLoadUserByUIDArg(u.G(), uid)
	staleOK := []bool{true, false}
	for _, b := range staleOK {
		arg.StaleOK = b
		upk, _, _ := u.loadWithInfo(arg, info)
		if upk == nil {
			continue
		}
		if pk := upk.FindDevice(did); pk != nil {
			return NewNormalizedUsername(upk.Base.Username), pk.DeviceDescription, pk.DeviceType, nil
		}
	}
	if err == nil {
		err = NotFoundError{fmt.Sprintf("UID/Device pair %s/%s not found", uid, did)}
	}
	return NormalizedUsername(""), "", "", err
}

func (u *CachedUserLoader) LookupUsernameAndDevice(uid keybase1.UID, did keybase1.DeviceID) (username NormalizedUsername, deviceName string, deviceType string, err error) {
	return u.lookupUsernameAndDeviceWithInfo(uid, did, nil)
}
