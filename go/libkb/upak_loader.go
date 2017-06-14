package libkb

import (
	"errors"
	"fmt"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

// UPAK Loader is a loader for UserPlusKeysV2AllIncarnations. It's a thin user object that is
// almost as good for many purposes, but can be safely copied and serialized.
type UPAKLoader interface {
	ClearMemory()
	Load(arg LoadUserArg) (ret *keybase1.UserPlusAllKeys, user *User, err error)
	CheckKIDForUID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, deleted bool, err error)
	LoadUserPlusKeys(ctx context.Context, uid keybase1.UID, pollForKID keybase1.KID) (keybase1.UserPlusKeys, error)
	Invalidate(ctx context.Context, uid keybase1.UID)
	LoadDeviceKey(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (upak *keybase1.UserPlusAllKeys, deviceKey *keybase1.PublicKey, revoked *keybase1.RevokedKey, err error)
	LookupUsername(ctx context.Context, uid keybase1.UID) (NormalizedUsername, error)
	LookupUsernameAndDevice(ctx context.Context, uid keybase1.UID, did keybase1.DeviceID) (username NormalizedUsername, deviceName string, deviceType string, err error)
	ListFollowedUIDs(uid keybase1.UID) ([]keybase1.UID, error)
	PutUserToCache(ctx context.Context, user *User) error
}

// CachedUPAKLoader is a UPAKLoader implementation that can cache results both
// in memory and on disk.
type CachedUPAKLoader struct {
	sync.Mutex
	Contextified
	m              map[string]*keybase1.UserPlusKeysV2AllIncarnations
	locktab        LockTable
	Freshness      time.Duration
	noCache        bool
	TestDeadlocker func()
}

// NewCachedUPAKLoader constructs a new CachedUPAKLoader
func NewCachedUPAKLoader(g *GlobalContext, f time.Duration) *CachedUPAKLoader {
	return &CachedUPAKLoader{
		Contextified: NewContextified(g),
		m:            make(map[string]*keybase1.UserPlusKeysV2AllIncarnations),
		Freshness:    f,
		noCache:      false,
	}
}

// NewUncachedUPAKLoader creates a UPAK loader that doesn't do any caching.
// It uses the implementation of CachedUPAKLoader but disables all caching.
func NewUncachedUPAKLoader(g *GlobalContext) UPAKLoader {
	return &CachedUPAKLoader{
		Contextified: NewContextified(g),
		Freshness:    time.Duration(0),
		noCache:      true,
	}
}

func culDBKeyV1(uid keybase1.UID) DbKey {
	return DbKeyUID(DBUserPlusAllKeysV1, uid)
}

func culDBKeyV2(uid keybase1.UID) DbKey {
	return DbKeyUID(DBUserPlusKeysAIV2, uid)
}

func (u *CachedUPAKLoader) ClearMemory() {
	u.Lock()
	defer u.Unlock()
	if u.noCache {
		return
	}
	u.m = make(map[string]*keybase1.UserPlusKeysV2AllIncarnations)
}

func (u *CachedUPAKLoader) getCachedUPAK(ctx context.Context, uid keybase1.UID, info *CachedUserLoadInfo) (*keybase1.UserPlusKeysV2AllIncarnations, bool) {

	if u.Freshness == time.Duration(0) || u.noCache {
		u.G().Log.CDebugf(ctx, "| cache miss since cache disabled")
		return nil, false
	}

	u.Lock()
	upak := u.m[uid.String()]
	u.Unlock()

	// Try loading from persistent storage if we missed memory cache.
	if upak != nil {
		u.G().Log.CDebugf(ctx, "| hit memory cache")
		if info != nil {
			info.InCache = true
		}
	} else {
		var tmp keybase1.UserPlusKeysV2AllIncarnations
		found, err := u.G().LocalDb.GetInto(&tmp, culDBKeyV2(uid))
		if err != nil {
			u.G().Log.CWarningf(ctx, "trouble accessing UserPlusKeysV2AllIncarnations cache: %s", err)
		} else if !found {
			u.G().Log.CDebugf(ctx, "| missed disk cache")
		} else {
			u.G().Log.CDebugf(ctx, "| hit disk cache")
			upak = &tmp
			if info != nil {
				info.InDiskCache = true
			}
			// Insert disk object into memory.
			u.Lock()
			u.m[uid.String()] = upak
			u.Unlock()
		}
	}

	if upak == nil {
		u.G().Log.CDebugf(ctx, "| missed cache")
		return nil, true
	}
	diff := u.G().Clock().Now().Sub(keybase1.FromTime(upak.Current.Uvv.CachedAt))
	fresh := (diff <= u.Freshness)
	if fresh {
		u.G().Log.CDebugf(ctx, "| cache hit was fresh (cached %s ago)", diff)
	} else {
		u.G().Log.CDebugf(ctx, "| cache hit was stale (by %s)", u.Freshness-diff)
	}
	return upak, fresh
}

type CachedUserLoadInfo struct {
	InCache      bool
	InDiskCache  bool
	TimedOut     bool
	StaleVersion bool
	LoadedLeaf   bool
	LoadedUser   bool
}

func (u *CachedUPAKLoader) Disable() {
	u.Freshness = time.Duration(0)
}

func culDebug(u keybase1.UID) string {
	return fmt.Sprintf("CachedUPAKLoader#Load(%s)", u)
}

func (u *CachedUPAKLoader) extractDeviceKey(upak keybase1.UserPlusAllKeys, deviceID keybase1.DeviceID) (deviceKey *keybase1.PublicKey, revoked *keybase1.RevokedKey, err error) {
	for i := range upak.Base.RevokedDeviceKeys {
		r := &upak.Base.RevokedDeviceKeys[i]
		pk := &r.Key
		if pk.DeviceID == deviceID {
			deviceKey = pk
			revoked = r
		}
	}
	for i := range upak.Base.DeviceKeys {
		pk := &upak.Base.DeviceKeys[i]
		if pk.DeviceID == deviceID {
			deviceKey = pk
			revoked = nil
		}
	}

	if deviceKey == nil {
		dkey := fmt.Sprintf("%s:%s", upak.Base.Uid, deviceID)
		return nil, nil, fmt.Errorf("device not found for %s", dkey)
	}

	return deviceKey, revoked, nil
}

func (u *CachedUPAKLoader) putUPAKToCache(ctx context.Context, obj *keybase1.UserPlusKeysV2AllIncarnations) error {

	if u.noCache {
		u.G().Log.CDebugf(ctx, "| no cache enabled, so not putting UPAK")
		return nil
	}

	uid := obj.Current.Uid
	u.G().Log.CDebugf(ctx, "| Caching UPAK for %s", uid)

	stale := false
	u.Lock()
	existing := u.m[uid.String()]
	if existing != nil && obj.IsOlderThan(*existing) {
		stale = true
	} else {
		u.m[uid.String()] = obj
	}
	u.Unlock()

	if stale {
		u.G().Log.CDebugf(ctx, "| CachedUpakLoader#putUPAKToCache: Refusing to overwrite with stale object")
		return errors.New("stale object rejected")
	}

	err := u.G().LocalDb.PutObj(culDBKeyV2(uid), nil, *obj)
	if err != nil {
		u.G().Log.CWarningf(ctx, "Error in writing UPAK for %s: %s", uid, err)
	}
	return err
}

func (u *CachedUPAKLoader) PutUserToCache(ctx context.Context, user *User) error {

	lock := u.locktab.AcquireOnName(ctx, u.G(), user.GetUID().String())
	defer lock.Release(ctx)
	upak := user.ExportToUPKV2AllIncarnations(keybase1.Time(0))
	upak.Current.Uvv.CachedAt = keybase1.ToTime(u.G().Clock().Now())
	err := u.putUPAKToCache(ctx, &upak)
	return err
}

// loadWithInfo loads a user by UID from the CachedUPAKLoader object. The 'info'
// object contains information about how the request was handled, but otherwise,
// this method behaves like (and implements) the public CachedUPAKLoader#Load
// method below. If `accessor` is nil, then a deep copy of the UPAK is returned.
// In some cases, that deep copy can be expensive, so as for users who have lots of
// followees. So if you provide accessor, the UPAK won't be deep-copied, but you'll
// be able to access it from inside the accessor with exclusion.
func (u *CachedUPAKLoader) loadWithInfo(arg LoadUserArg, info *CachedUserLoadInfo, accessor func(k *keybase1.UserPlusKeysV2AllIncarnations) error, shouldReturnFullUser bool) (ret *keybase1.UserPlusKeysV2AllIncarnations, user *User, err error) {

	// Shorthand
	g := u.G()

	// Add a LU= tax to this context, for all subsequent debugging
	ctx := arg.WithLogTag()

	defer g.CTrace(ctx, culDebug(arg.UID), func() error { return err })()

	if arg.UID.IsNil() {
		err = errors.New("need a UID to load UPAK from loader")
		return nil, nil, err
	}

	lock := u.locktab.AcquireOnName(ctx, g, arg.UID.String())

	defer func() {
		lock.Release(ctx)

		if !shouldReturnFullUser {
			user = nil
		}
		if user != nil && err == nil {
			// Update the full-self cacher after the lock is released, to avoid
			// any circular locking.
			if fs := u.G().GetFullSelfer(); fs != nil {
				fs.Update(ctx, user)
			}
		}
	}()

	returnUPAK := func(upak *keybase1.UserPlusKeysV2AllIncarnations, needCopy bool) (*keybase1.UserPlusKeysV2AllIncarnations, *User, error) {
		if accessor != nil {
			err := accessor(upak)
			if err != nil {
				return nil, nil, err
			}
			return nil, user, err
		}
		if needCopy {
			tmp := upak.DeepCopy()
			upak = &tmp
		}
		return upak, user, nil
	}

	var upak *keybase1.UserPlusKeysV2AllIncarnations
	var fresh bool

	if !arg.ForceReload {
		upak, fresh = u.getCachedUPAK(ctx, arg.UID, info)
	}
	if arg.ForcePoll {
		g.Log.CDebugf(ctx, "%s: force-poll required us to repoll (fresh=%v)", culDebug(arg.UID), fresh)
		fresh = false
	}

	if upak != nil {
		g.Log.CDebugf(ctx, "%s: cache-hit; fresh=%v", culDebug(arg.UID), fresh)
		if fresh || arg.StaleOK {
			return returnUPAK(upak, true)
		}
		if info != nil {
			info.TimedOut = true
		}

		var sigHints *SigHints
		var leaf *MerkleUserLeaf

		sigHints, leaf, err = lookupSigHintsAndMerkleLeaf(ctx, u.G(), arg.UID, true)
		if err != nil {
			return nil, nil, err
		}

		if info != nil {
			info.LoadedLeaf = true
		}

		if leaf.eldest == "" {
			g.Log.CDebugf(ctx, "%s: cache-hit; but user is nuked, evicting", culDebug(arg.UID))

			// Our cached user turned out to be in reset state (without
			// current sigchain), remove from cache, and then fall
			// through. LoadUser shall return an error, which we will
			// return to the caller.
			u.Lock()
			delete(u.m, arg.UID.String())
			u.Unlock()

			err := u.G().LocalDb.Delete(culDBKeyV2(arg.UID))
			if err != nil {
				u.G().Log.Warning("Failed to remove %s from disk cache: %s", arg.UID, err)
			}
		} else if leaf.public != nil && leaf.public.Seqno == keybase1.Seqno(upak.Current.Uvv.SigChain) {
			g.Log.CDebugf(ctx, "%s: cache-hit; fresh after poll", culDebug(arg.UID))

			upak.Current.Uvv.CachedAt = keybase1.ToTime(g.Clock().Now())
			// This is only necessary to update the levelDB representation,
			// since the previous line updates the in-memory cache satisfactorially.
			u.putUPAKToCache(ctx, upak)

			return returnUPAK(upak, true)
		}

		if info != nil {
			info.StaleVersion = true
		}
		arg.SigHints = sigHints
		arg.MerkleLeaf = leaf
	} else if arg.CachedOnly {
		return nil, nil, UserNotFoundError{UID: arg.UID, Msg: "no cached user found"}
	}

	g.Log.CDebugf(ctx, "%s: LoadUser", culDebug(arg.UID))
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

	tmp := user.ExportToUPKV2AllIncarnations(keybase1.Time(0))
	ret = &tmp
	ret.Current.Uvv.CachedAt = keybase1.ToTime(g.Clock().Now())
	err = u.putUPAKToCache(ctx, ret)

	if u.TestDeadlocker != nil {
		u.TestDeadlocker()
	}

	return returnUPAK(ret, false)
}

// Load a UserPlusKeysV2AllIncarnations from the local cache, falls back to
// LoadUser, and cache the user. Can only perform lookups by UID. Will return a
// non-nil UserPlusKeysV2AllIncarnations, or a non-nil error, but never both
// non-nil, nor never both nil. If we had to do a full LoadUser as part of the
// request, it's returned too. Convert to UserPlusAllKeys on the way out, for
// backwards compatibility.
func (u *CachedUPAKLoader) Load(arg LoadUserArg) (*keybase1.UserPlusAllKeys, *User, error) {
	ret, user, err := u.loadWithInfo(arg, nil, nil, true)
	if err != nil {
		return nil, nil, err
	}
	converted := keybase1.UPAKFromUPKV2AI(*ret)
	return &converted, user, err
}

func (u *CachedUPAKLoader) CheckKIDForUID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, deleted bool, err error) {

	var info CachedUserLoadInfo
	larg := NewLoadUserByUIDArg(ctx, u.G(), uid)
	larg.PublicKeyOptional = true
	upak, _, err := u.loadWithInfo(larg, &info, nil, false)

	if err != nil {
		return false, nil, false, err
	}
	found, revokedAt, deleted = CheckKID(upak, kid)
	if found || info.LoadedLeaf || info.LoadedUser {
		return found, revokedAt, deleted, nil
	}
	larg.ForceReload = true
	upak, _, err = u.loadWithInfo(larg, nil, nil, false)
	if err != nil {
		return false, nil, false, err
	}
	found, revokedAt, deleted = CheckKID(upak, kid)
	return found, revokedAt, deleted, nil
}

func (u *CachedUPAKLoader) LoadUserPlusKeys(ctx context.Context, uid keybase1.UID, pollForKID keybase1.KID) (keybase1.UserPlusKeys, error) {
	var up keybase1.UserPlusKeys
	if uid.IsNil() {
		return up, NoUIDError{}
	}

	arg := NewLoadUserArg(u.G())
	arg.UID = uid
	arg.PublicKeyOptional = true
	arg.NetContext = ctx

	forcePollValues := []bool{false, true}

	for _, fp := range forcePollValues {

		arg.ForcePoll = fp

		upak, _, err := u.Load(arg)
		if err != nil {
			return up, err
		}
		if upak == nil {
			return up, fmt.Errorf("Nil user, nil error from LoadUser")
		}
		up = upak.Base
		if pollForKID.IsNil() || up.FindKID(pollForKID) != nil {
			break
		}

	}
	return up, nil
}

func (u *CachedUPAKLoader) Invalidate(ctx context.Context, uid keybase1.UID) {

	u.G().Log.Debug("| CachedUPAKLoader#Invalidate(%s)", uid)

	if u.noCache {
		return
	}

	lock := u.locktab.AcquireOnName(ctx, u.G(), uid.String())
	defer lock.Release(ctx)

	u.Lock()
	delete(u.m, uid.String())
	u.Unlock()

	err := u.G().LocalDb.Delete(culDBKeyV2(uid))
	if err != nil {
		u.G().Log.Warning("Failed to remove %s from disk cache: %s", uid, err)
	}
}

// Load the PublicKey for a user's device from the local cache, falling back to LoadUser, and cache the user.
// If the user exists but the device doesn't, will force a load in case the device is very new.
func (u *CachedUPAKLoader) LoadDeviceKey(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (upakv1 *keybase1.UserPlusAllKeys, deviceKey *keybase1.PublicKey, revoked *keybase1.RevokedKey, err error) {
	var info CachedUserLoadInfo
	larg := NewLoadUserByUIDArg(ctx, u.G(), uid)
	upakV2, _, err := u.loadWithInfo(larg, &info, nil, false)
	if err != nil {
		return nil, nil, nil, err
	}
	upakV1 := keybase1.UPAKFromUPKV2AI(*upakV2)

	deviceKey, revoked, err = u.extractDeviceKey(upakV1, deviceID)
	if err == nil {
		// Early success, return
		return &upakV1, deviceKey, revoked, err
	}

	// Try again with a forced load in case the device is very new.
	larg.ForcePoll = true
	upakV2, _, err = u.loadWithInfo(larg, nil, nil, false)
	if err != nil {
		return nil, nil, nil, err
	}
	upakV1 = keybase1.UPAKFromUPKV2AI(*upakV2)

	deviceKey, revoked, err = u.extractDeviceKey(upakV1, deviceID)
	return &upakV1, deviceKey, revoked, err
}

func (u *CachedUPAKLoader) LookupUsername(ctx context.Context, uid keybase1.UID) (NormalizedUsername, error) {
	var info CachedUserLoadInfo
	arg := NewLoadUserByUIDArg(ctx, u.G(), uid)
	arg.StaleOK = true
	var ret NormalizedUsername
	_, _, err := u.loadWithInfo(arg, &info, func(upak *keybase1.UserPlusKeysV2AllIncarnations) error {
		if upak == nil {
			return UserNotFoundError{UID: uid, Msg: "in CachedUPAKLoader"}
		}
		ret = NewNormalizedUsername(upak.Current.Username)
		return nil
	}, false)
	return ret, err
}

func (u *CachedUPAKLoader) lookupUsernameAndDeviceWithInfo(ctx context.Context, uid keybase1.UID, did keybase1.DeviceID, info *CachedUserLoadInfo) (username NormalizedUsername, deviceName string, deviceType string, err error) {
	arg := NewLoadUserByUIDArg(ctx, u.G(), uid)

	// First iteration through, say it's OK to load a stale user. Note that the
	// mappings of UID to Username and DeviceID to DeviceName are immutable, so this
	// data can never be stale. However, our user might be out of date and lack the
	// mappings, so the second time through, we request a fresh object.
	staleOK := []bool{true, false}
	for _, b := range staleOK {
		arg.StaleOK = b
		found := false
		u.loadWithInfo(arg, info, func(upak *keybase1.UserPlusKeysV2AllIncarnations) error {
			if upak == nil {
				return nil
			}
			if pk := upak.FindDevice(did); pk != nil {
				username = NewNormalizedUsername(upak.Current.Username)
				deviceName = pk.DeviceDescription
				deviceType = pk.DeviceType
				found = true
			}
			return nil
		}, false)
		if found {
			return username, deviceName, deviceType, nil
		}
	}
	if err == nil {
		err = NotFoundError{fmt.Sprintf("UID/Device pair %s/%s not found", uid, did)}
	}
	return NormalizedUsername(""), "", "", err
}

func (u *CachedUPAKLoader) LookupUsernameAndDevice(ctx context.Context, uid keybase1.UID, did keybase1.DeviceID) (username NormalizedUsername, deviceName string, deviceType string, err error) {
	return u.lookupUsernameAndDeviceWithInfo(ctx, uid, did, nil)
}

func (u *CachedUPAKLoader) ListFollowedUIDs(uid keybase1.UID) ([]keybase1.UID, error) {
	arg := NewLoadUserByUIDArg(nil, u.G(), uid)
	upak, _, err := u.Load(arg)
	if err != nil {
		return nil, err
	}
	var ret []keybase1.UID
	for _, t := range upak.RemoteTracks {
		ret = append(ret, t.Uid)
	}
	return ret, nil
}
