package libkb

import (
	"errors"
	"fmt"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// UPAK Loader is a loader for UserPlusAllKeys. It's a thin user object that is
// almost as good for many purposes, but can be safely copied and serialized.
type UPAKLoader interface {
	ClearMemory()
	Load(arg LoadUserArg) (ret *keybase1.UserPlusAllKeys, user *User, err error)
	CheckKIDForUID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, deleted bool, err error)
	LoadUserPlusKeys(ctx context.Context, uid keybase1.UID, pollForKID keybase1.KID) (keybase1.UserPlusKeys, error)
	Invalidate(ctx context.Context, uid keybase1.UID)
	LoadDeviceKey(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (upk *keybase1.UserPlusAllKeys, deviceKey *keybase1.PublicKey, revoked *keybase1.RevokedKey, err error)
	LookupUsername(ctx context.Context, uid keybase1.UID) (NormalizedUsername, error)
	LookupUsernameAndDevice(ctx context.Context, uid keybase1.UID, did keybase1.DeviceID) (username NormalizedUsername, deviceName string, deviceType string, err error)
	ListFollowedUIDs(uid keybase1.UID) ([]keybase1.UID, error)
	PutUserToCache(user *User) error
	loadWithInfo(arg LoadUserArg, info *CachedUserLoadInfo) (ret *keybase1.UserPlusAllKeys, user *User, err error)
}

// CachedUPAKLoader is a UPAKLoader implementation that can cache results both
// in memory and on disk.
type CachedUPAKLoader struct {
	sync.Mutex
	Contextified
	m         map[string]*keybase1.UserPlusAllKeys
	locktab   LockTable
	Freshness time.Duration
	noCache   bool
}

// NewCachedUPAKLoader constructs a new CachedUPAKLoader
func NewCachedUPAKLoader(g *GlobalContext, f time.Duration) *CachedUPAKLoader {
	return &CachedUPAKLoader{
		Contextified: NewContextified(g),
		m:            make(map[string]*keybase1.UserPlusAllKeys),
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

func culDBKey(uid keybase1.UID) DbKey {
	return DbKeyUID(DBUserPlusAllKeys, uid)
}

func (u *CachedUPAKLoader) ClearMemory() {
	u.Lock()
	defer u.Unlock()
	if u.noCache {
		return
	}
	u.m = make(map[string]*keybase1.UserPlusAllKeys)
}

func (u *CachedUPAKLoader) getCachedUPK(ctx context.Context, uid keybase1.UID, info *CachedUserLoadInfo) (*keybase1.UserPlusAllKeys, bool) {

	if u.Freshness == time.Duration(0) || u.noCache {
		u.G().Log.CDebugf(ctx, "| cache miss since cache disabled")
		return nil, false
	}

	u.Lock()
	upk := u.m[uid.String()]
	u.Unlock()

	// Try loading from persistent storage if we missed memory cache.
	if upk != nil {
		u.G().Log.CDebugf(ctx, "| hit memory cache")
		if info != nil {
			info.InCache = true
		}
	} else {
		var tmp keybase1.UserPlusAllKeys
		found, err := u.G().LocalDb.GetInto(&tmp, culDBKey(uid))
		if err != nil {
			u.G().Log.CWarningf(ctx, "trouble accessing UserPlusAllKeys cache: %s", err)
		} else if !found {
			u.G().Log.CDebugf(ctx, "| missed disk cache")
		} else {
			u.G().Log.CDebugf(ctx, "| hit disk cache")
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
		u.G().Log.CDebugf(ctx, "| missed cache")
		return nil, true
	}
	diff := u.G().Clock().Now().Sub(keybase1.FromTime(upk.Base.Uvv.CachedAt))
	fresh := (diff <= u.Freshness)
	if fresh {
		u.G().Log.CDebugf(ctx, "| cache hit was fresh (cached %s ago)", diff)
	} else {
		u.G().Log.CDebugf(ctx, "| cache hit was stale (by %s)", u.Freshness-diff)
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

func (u *CachedUPAKLoader) Disable() {
	u.Freshness = time.Duration(0)
}

func culDebug(u keybase1.UID) string {
	return fmt.Sprintf("CachedUPAKLoader#Load(%s)", u)
}

func (u *CachedUPAKLoader) extractDeviceKey(upk *keybase1.UserPlusAllKeys, deviceID keybase1.DeviceID) (deviceKey *keybase1.PublicKey, revoked *keybase1.RevokedKey, err error) {
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

func (u *CachedUPAKLoader) putUPKToCache(ctx context.Context, obj *keybase1.UserPlusAllKeys) error {

	if u.noCache {
		u.G().Log.CDebugf(ctx, "| no cache enabled, so not putting UPAK")
		return nil
	}

	uid := obj.Base.Uid
	u.G().Log.CDebugf(ctx, "| Caching UPAK for %s", uid)
	u.Lock()
	u.m[uid.String()] = obj
	u.Unlock()
	err := u.G().LocalDb.PutObj(culDBKey(uid), nil, *obj)
	if err != nil {
		u.G().Log.CWarningf(ctx, "Error in writing UPAK for %s: %s", uid, err)
	}
	return err
}

func (u *CachedUPAKLoader) PutUserToCache(user *User) error {
	upak := user.ExportToUserPlusAllKeys(keybase1.Time(0))
	upak.Base.Uvv.CachedAt = keybase1.ToTime(u.G().Clock().Now())
	err := u.putUPKToCache(nil, &upak)
	return err
}

// loadWithInfo loads a user by UID from the CachedUPAKLoader object. The 'info'
// object contains information about how the request was handled, but otherwise,
// this method behaves like (and implements) the public CachedUPAKLoader#Load
// method below.
func (u *CachedUPAKLoader) loadWithInfo(arg LoadUserArg, info *CachedUserLoadInfo) (ret *keybase1.UserPlusAllKeys, user *User, err error) {

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
	defer lock.Release(ctx)

	var upk *keybase1.UserPlusAllKeys
	var fresh bool

	if !arg.ForceReload {
		upk, fresh = u.getCachedUPK(ctx, arg.UID, info)
	}
	if arg.ForcePoll {
		g.Log.CDebugf(ctx, "%s: force-poll required us to repoll (fresh=%v)", culDebug(arg.UID), fresh)
		fresh = false
	}

	if upk != nil {
		g.Log.CDebugf(ctx, "%s: cache-hit; fresh=%v", culDebug(arg.UID), fresh)
		if fresh || arg.StaleOK {
			return upk.DeepCopy(), nil, nil
		}
		if info != nil {
			info.TimedOut = true
		}

		var sigHints *SigHints
		sigHints, err = LoadSigHints(ctx, arg.UID, g)
		if err != nil {
			return nil, nil, err
		}

		var leaf *MerkleUserLeaf
		leaf, err = lookupMerkleLeaf(ctx, g, arg.UID, true, sigHints)
		if err != nil {
			return nil, nil, err
		}
		if info != nil {
			info.LoadedLeaf = true
		}
		if leaf.public != nil && leaf.public.Seqno == Seqno(upk.Base.Uvv.SigChain) {
			g.Log.CDebugf(ctx, "%s: cache-hit; fresh after poll", culDebug(arg.UID))

			upk.Base.Uvv.CachedAt = keybase1.ToTime(g.Clock().Now())
			// This is only necessary to update the levelDB representation,
			// since the previous line updates the in-memory cache satisfactorially.
			u.putUPKToCache(ctx, upk)

			return upk.DeepCopy(), nil, nil
		}

		if info != nil {
			info.StaleVersion = true
		}
		arg.SigHints = sigHints
		arg.MerkleLeaf = leaf
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

	tmp := user.ExportToUserPlusAllKeys(keybase1.Time(0))
	ret = &tmp
	ret.Base.Uvv.CachedAt = keybase1.ToTime(g.Clock().Now())
	err = u.putUPKToCache(ctx, ret)

	return ret, user, nil
}

// Load a UserPlusAllKeys from the local cache, falls back to LoadUser, and cache the user.
// Can only perform lookups by UID. Will return a non-nil UserPlusAllKeys, or a non-nil error,
// but never both non-nil, nor never both nil. If we had to do a full LoadUser as part of the
// request, it's returned too.
func (u *CachedUPAKLoader) Load(arg LoadUserArg) (ret *keybase1.UserPlusAllKeys, user *User, err error) {
	return u.loadWithInfo(arg, nil)
}

func (u *CachedUPAKLoader) CheckKIDForUID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, deleted bool, err error) {

	var info CachedUserLoadInfo
	larg := NewLoadUserByUIDArg(ctx, u.G(), uid)
	larg.PublicKeyOptional = true
	upk, _, err := u.loadWithInfo(larg, &info)

	if err != nil {
		return false, nil, false, err
	}
	found, revokedAt, deleted = CheckKID(upk, kid)
	if found || info.LoadedLeaf || info.LoadedUser {
		return found, revokedAt, deleted, nil
	}
	larg.ForceReload = true
	upk, _, err = u.loadWithInfo(larg, nil)
	if err != nil {
		return false, nil, false, err
	}
	found, revokedAt, deleted = CheckKID(upk, kid)
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
		// We need to force a reload to make KBFS tests pass
		arg.ForcePoll = fp || (u.G().Env.GetRunMode() == DevelRunMode)

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

	u.G().Log.Debug("CachedUPAKLoader#Invalidate(%s)", uid)

	if u.noCache {
		return
	}

	lock := u.locktab.AcquireOnName(ctx, u.G(), uid.String())
	defer lock.Release(ctx)

	u.Lock()
	delete(u.m, uid.String())
	u.Unlock()

	err := u.G().LocalDb.Delete(culDBKey(uid))
	if err != nil {
		u.G().Log.Warning("Failed to remove %s from disk cache: %s", uid, err)
	}
}

// Load the PublicKey for a user's device from the local cache, falling back to LoadUser, and cache the user.
// If the user exists but the device doesn't, will force a load in case the device is very new.
func (u *CachedUPAKLoader) LoadDeviceKey(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (upk *keybase1.UserPlusAllKeys, deviceKey *keybase1.PublicKey, revoked *keybase1.RevokedKey, err error) {
	var info CachedUserLoadInfo
	larg := NewLoadUserByUIDArg(ctx, u.G(), uid)
	upk, _, err = u.loadWithInfo(larg, &info)
	if err != nil {
		return nil, nil, nil, err
	}

	deviceKey, revoked, err = u.extractDeviceKey(upk, deviceID)
	if err == nil {
		// Early success, return
		return upk, deviceKey, revoked, err
	}

	// Try again with a forced load in case the device is very new.
	larg.ForcePoll = true
	upk, _, err = u.loadWithInfo(larg, nil)
	if err != nil {
		return nil, nil, nil, err
	}

	deviceKey, revoked, err = u.extractDeviceKey(upk, deviceID)
	return upk, deviceKey, revoked, err
}

func (u *CachedUPAKLoader) LookupUsername(ctx context.Context, uid keybase1.UID) (NormalizedUsername, error) {
	var info CachedUserLoadInfo
	arg := NewLoadUserByUIDArg(ctx, u.G(), uid)
	arg.StaleOK = true
	upk, _, err := u.loadWithInfo(arg, &info)
	var blank NormalizedUsername
	if err != nil {
		return blank, err
	}
	if upk == nil {
		return blank, UserNotFoundError{UID: uid, Msg: "in CachedUPAKLoader"}
	}
	return NewNormalizedUsername(upk.Base.Username), nil
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

func (u *CachedUPAKLoader) LookupUsernameAndDevice(ctx context.Context, uid keybase1.UID, did keybase1.DeviceID) (username NormalizedUsername, deviceName string, deviceType string, err error) {
	return u.lookupUsernameAndDeviceWithInfo(ctx, uid, did, nil)
}

func (u *CachedUPAKLoader) ListFollowedUIDs(uid keybase1.UID) ([]keybase1.UID, error) {
	arg := NewLoadUserByUIDArg(nil, u.G(), uid)
	upk, _, err := u.Load(arg)
	if err != nil {
		return nil, err
	}
	var ret []keybase1.UID
	for _, t := range upk.RemoteTracks {
		ret = append(ret, t.Uid)
	}
	return ret, nil
}
