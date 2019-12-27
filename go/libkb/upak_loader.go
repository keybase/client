package libkb

import (
	"errors"
	"fmt"
	"time"

	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

// UPAK Loader is a loader for UserPlusKeysV2AllIncarnations. It's a thin user object that is
// almost as good for many purposes, but can be safely copied and serialized.
type UPAKLoader interface {
	LoginAs(u keybase1.UID) (err error)
	OnLogout() (err error)
	ClearMemory()
	Load(arg LoadUserArg) (ret *keybase1.UserPlusAllKeys, user *User, err error)
	LoadV2(arg LoadUserArg) (ret *keybase1.UserPlusKeysV2AllIncarnations, user *User, err error)
	LoadLite(arg LoadUserArg) (ret *keybase1.UPKLiteV1AllIncarnations, err error)
	CheckKIDForUID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, deleted bool, err error)
	LoadUserPlusKeys(ctx context.Context, uid keybase1.UID, pollForKID keybase1.KID) (keybase1.UserPlusKeys, error)
	LoadKeyV2(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (*keybase1.UserPlusKeysV2, *keybase1.UserPlusKeysV2AllIncarnations, *keybase1.PublicKeyV2NaCl, error)
	Invalidate(ctx context.Context, uid keybase1.UID)
	LoadDeviceKey(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (upak *keybase1.UserPlusAllKeys, deviceKey *keybase1.PublicKey, revoked *keybase1.RevokedKey, err error)
	LoadUPAKWithDeviceID(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (*keybase1.UserPlusKeysV2AllIncarnations, error)
	LookupUsername(ctx context.Context, uid keybase1.UID) (NormalizedUsername, error)
	LookupUsernameUPAK(ctx context.Context, uid keybase1.UID) (NormalizedUsername, error)
	LookupUID(ctx context.Context, un NormalizedUsername) (keybase1.UID, error)
	LookupUsernameAndDevice(ctx context.Context, uid keybase1.UID, did keybase1.DeviceID) (username NormalizedUsername, deviceName string, deviceType string, err error)
	ListFollowedUIDs(ctx context.Context, uid keybase1.UID) ([]keybase1.UID, error)
	PutUserToCache(ctx context.Context, user *User) error
	LoadV2WithKID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (*keybase1.UserPlusKeysV2AllIncarnations, error)
	CheckDeviceForUIDAndUsername(ctx context.Context, uid keybase1.UID, did keybase1.DeviceID, n NormalizedUsername, suppressNetworkErrors bool) error
	Batcher(ctx context.Context, getArg func(int) *LoadUserArg, processResult func(int, *keybase1.UserPlusKeysV2AllIncarnations) error, ignoreError func(err error) bool, window int) (err error)
}

// CachedUPAKLoader is a UPAKLoader implementation that can cache results both
// in memory and on disk.
type CachedUPAKLoader struct {
	Contextified
	sync.Mutex
	cache          *lru.Cache
	locktab        *LockTable
	Freshness      time.Duration
	noCache        bool
	TestDeadlocker func()
	currentUID     keybase1.UID
}

// NewCachedUPAKLoader constructs a new CachedUPAKLoader
func NewCachedUPAKLoader(g *GlobalContext, f time.Duration) *CachedUPAKLoader {
	c, err := lru.New(g.Env.GetUPAKCacheSize())
	if err != nil {
		panic(fmt.Sprintf("could not create lru cache (size = %d)", g.Env.GetUPAKCacheSize()))
	}
	return &CachedUPAKLoader{
		Contextified: NewContextified(g),
		Freshness:    f,
		cache:        c,
		noCache:      false,
		locktab:      NewLockTable(),
	}
}

func (u *CachedUPAKLoader) LoginAs(uid keybase1.UID) (err error) {
	u.Lock()
	defer u.Unlock()
	u.currentUID = uid
	return nil
}

func (u *CachedUPAKLoader) GetCurrentUID() keybase1.UID {
	u.Lock()
	defer u.Unlock()
	return u.currentUID
}

func (u *CachedUPAKLoader) OnLogout() (err error) {
	return u.LoginAs(keybase1.UID(""))
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

func culDBKeyVersioned(version int, uid keybase1.UID, stubMode StubMode) DbKey {

	typ := DBUserPlusKeysVersioned
	if stubMode == StubModeUnstubbed {
		typ = DBUserPlusKeysVersionedUnstubbed
	}
	return DbKey{
		Typ: ObjType(typ),
		Key: fmt.Sprintf("%d:%s", version, uid.String()),
	}
}

func culDBKeyV2(uid keybase1.UID, stubMode StubMode) DbKey {
	return culDBKeyVersioned(2, uid, stubMode)
}

func (u *CachedUPAKLoader) ClearMemory() {
	if u.noCache {
		return
	}
	u.purgeMemCache()
}

const UPK2MinorVersionCurrent = keybase1.UPK2MinorVersion_V6

func (u *CachedUPAKLoader) getCachedUPAKFromDB(ctx context.Context, uid keybase1.UID, stubMode StubMode) (ret *keybase1.UserPlusKeysV2AllIncarnations) {
	var tmp keybase1.UserPlusKeysV2AllIncarnations
	found, err := u.G().LocalDb.GetInto(&tmp, culDBKeyV2(uid, stubMode))

	if err != nil {
		u.G().Log.CWarningf(ctx, "trouble accessing UserPlusKeysV2AllIncarnations cache: %s", err)
		return nil
	}
	if !found {
		u.G().VDL.CLogf(ctx, VLog0, "| missed disk cache")
		return nil
	}
	if tmp.MinorVersion != UPK2MinorVersionCurrent {
		u.G().VDL.CLogf(ctx, VLog0, "| found old minor version %d, but wanted %d; will overwrite with fresh UPAK", tmp.MinorVersion, UPK2MinorVersionCurrent)
		return nil
	}

	u.G().VDL.CLogf(ctx, VLog0, "| hit disk cache (v%d)", tmp.MinorVersion)
	u.putMemCache(ctx, uid, stubMode, tmp)
	return &tmp
}

func (u *CachedUPAKLoader) getCachedUPAKFromDBMaybeTryBothSlots(ctx context.Context, uid keybase1.UID, stubMode StubMode) (ret *keybase1.UserPlusKeysV2AllIncarnations, finalStubMode StubMode) {
	return pickBetterFromCache(func(stubMode StubMode) *keybase1.UserPlusKeysV2AllIncarnations {
		return u.getCachedUPAKFromDB(ctx, uid, stubMode)
	}, stubMode)
}

func (u *CachedUPAKLoader) getMemCacheMaybeTryBothSlots(ctx context.Context, uid keybase1.UID, stubMode StubMode) (ret *keybase1.UserPlusKeysV2AllIncarnations, finalStubMode StubMode) {
	return pickBetterFromCache(func(stubMode StubMode) *keybase1.UserPlusKeysV2AllIncarnations {
		return u.getMemCache(ctx, uid, stubMode)
	}, stubMode)
}

func pickBetterFromCache(getter func(stubMode StubMode) *keybase1.UserPlusKeysV2AllIncarnations, stubMode StubMode) (ret *keybase1.UserPlusKeysV2AllIncarnations, finalStubMode StubMode) {

	ret = getter(stubMode)
	if stubMode == StubModeUnstubbed {
		return ret, StubModeUnstubbed
	}

	stubbed := ret
	unstubbed := getter(StubModeUnstubbed)

	if unstubbed == nil {
		return stubbed, StubModeStubbed
	}
	if stubbed == nil {
		return unstubbed, StubModeUnstubbed
	}
	if unstubbed.IsOlderThan(*stubbed) {
		return stubbed, StubModeStubbed
	}
	return unstubbed, StubModeUnstubbed
}

func (u *CachedUPAKLoader) getCachedUPAKTryMemThenDisk(ctx context.Context, uid keybase1.UID, stubMode StubMode, info *CachedUserLoadInfo) *keybase1.UserPlusKeysV2AllIncarnations {
	upak, cacheStubMode := u.getMemCacheMaybeTryBothSlots(ctx, uid, stubMode)

	if upak != nil {
		// Note that below we check the minor version and then discard the cached object if it's
		// stale. But no need in memory, since we'll never have the old version in memory.
		u.G().VDL.CLogf(ctx, VLog0, "| hit memory cache (%s -> %s)", stubMode, cacheStubMode)
		if info != nil {
			info.InCache = true
		}
		return upak
	}

	upak, cacheStubMode = u.getCachedUPAKFromDBMaybeTryBothSlots(ctx, uid, stubMode)
	if upak == nil {
		u.G().VDL.CLogf(ctx, VLog0, "| missed cache")
		return nil
	}

	u.G().VDL.CLogf(ctx, VLog0, "| hit disk cache (%s -> %s)", stubMode, cacheStubMode)
	if info != nil {
		info.InDiskCache = true
	}

	return upak
}

func (u *CachedUPAKLoader) getCachedUPAK(ctx context.Context, uid keybase1.UID, stubMode StubMode, info *CachedUserLoadInfo) (*keybase1.UserPlusKeysV2AllIncarnations, bool) {

	if u.Freshness == time.Duration(0) || u.noCache {
		u.G().VDL.CLogf(ctx, VLog0, "| cache miss since cache disabled")
		return nil, false
	}

	upak := u.getCachedUPAKTryMemThenDisk(ctx, uid, stubMode, info)

	if upak == nil {
		return nil, true
	}

	diff := u.G().Clock().Now().Sub(keybase1.FromTime(upak.Uvv.CachedAt))
	fresh := (diff <= u.Freshness)
	if fresh {
		u.G().VDL.CLogf(ctx, VLog0, "| cache hit was fresh (cached %s ago)", diff)
	} else {
		u.G().VDL.CLogf(ctx, VLog0, "| cache hit was stale (by %s)", u.Freshness-diff)
	}
	if upak.Stale {
		u.G().VDL.CLogf(ctx, VLog0, "| object is stale by persisted stale bit")
		fresh = false
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

func (u *CachedUPAKLoader) putUPAKToDB(ctx context.Context, uid keybase1.UID, stubMode StubMode, obj keybase1.UserPlusKeysV2AllIncarnations) (err error) {
	err = u.G().LocalDb.PutObj(culDBKeyV2(uid, stubMode), nil, obj)
	if err != nil {
		u.G().Log.CWarningf(ctx, "Error in writing UPAK for %s %s: %s", uid, stubMode, err)
	}
	return err
}

func (u *CachedUPAKLoader) putUPAKToCache(ctx context.Context, obj *keybase1.UserPlusKeysV2AllIncarnations, stubMode StubMode) (err error) {

	if u.noCache {
		u.G().VDL.CLogf(ctx, VLog0, "| no cache enabled, so not putting UPAK")
		return nil
	}

	uid := obj.Current.Uid
	u.G().VDL.CLogf(ctx, VLog0, "| Caching UPAK for %s %s", uid, stubMode)

	// At this point, we've gone to the server, and we checked that the user is fresh, so if we previously had a stale
	// bit set for this user, we'll turn it off now.
	if obj.Stale {
		u.G().VDL.CLogf(ctx, VLog0, "| resetting stale bit to false for %s %s", uid, stubMode)
		obj.Stale = false
	}

	existing := u.getMemCache(ctx, uid, stubMode)

	if existing != nil && obj.IsOlderThan(*existing) {
		u.G().VDL.CLogf(ctx, VLog0, "| CachedUpakLoader#putUPAKToCache: Refusing to overwrite with stale object")
		return errors.New("stale object rejected")
	}
	u.putMemCache(ctx, uid, stubMode, *obj)

	err = u.putUPAKToDB(ctx, uid, stubMode, *obj)

	u.deleteV1UPAK(uid)
	return err
}

func (u *CachedUPAKLoader) PutUserToCache(ctx context.Context, user *User) error {
	lock := u.locktab.AcquireOnName(ctx, u.G(), user.GetUID().String())
	defer lock.Release(ctx)
	upak, err := user.ExportToUPKV2AllIncarnations()
	if err != nil {
		return err
	}
	upak.Uvv.CachedAt = keybase1.ToTime(u.G().Clock().Now())
	err = u.putUPAKToCache(ctx, upak, StubModeFromUnstubbedBool(upak.Current.Unstubbed))
	return err
}

func (u *CachedUPAKLoader) LoadLite(arg LoadUserArg) (*keybase1.UPKLiteV1AllIncarnations, error) {
	m, tbs := arg.m.WithTimeBuckets()
	arg.m = m
	defer tbs.Record("CachedUPAKLoader.LoadLite")()
	g := m.G()
	uid := arg.uid

	if uid.IsNil() {
		return nil, errors.New("need a UID to load a UPAK lite")
	}
	lock := u.locktab.AcquireOnName(m.ctx, g, uid.String())
	defer func() {
		lock.Release(m.ctx)
	}()

	upakLite, err := LoadUPAKLite(arg)
	return upakLite, err
}

// loadWithInfo loads a user from the CachedUPAKLoader object. The 'info'
// object contains information about how the request was handled, but otherwise,
// this method behaves like (and implements) the public CachedUPAKLoader#Load
// method below. If `accessor` is nil, then a deep copy of the UPAK is returned.
// In some cases, that deep copy can be expensive, so as for users who have lots of
// followees. So if you provide accessor, the UPAK won't be deep-copied, but you'll
// be able to access it from inside the accessor with exclusion.
func (u *CachedUPAKLoader) loadWithInfo(arg LoadUserArg, info *CachedUserLoadInfo, accessor func(k *keybase1.UserPlusKeysV2AllIncarnations) error, shouldReturnFullUser bool) (ret *keybase1.UserPlusKeysV2AllIncarnations, user *User, err error) {

	// Add a LU= tax to this context, for all subsequent debugging
	arg = arg.EnsureCtxAndLogTag()

	// Shorthands
	m := arg.MetaContext()
	m, tbs := arg.m.WithTimeBuckets()
	g := m.G()
	ctx := m.Ctx()

	defer m.VTrace(VLog0, culDebug(arg.uid), func() error { return err })()

	if arg.uid.IsNil() {
		if len(arg.name) == 0 {
			return nil, nil, errors.New("need a UID or username to load UPAK from loader")
		}
		// Modifies the load arg, setting a UID
		arg.uid, err = u.LookupUID(ctx, NewNormalizedUsername(arg.name))
		if err != nil {
			return nil, nil, err
		}
	}

	lock := u.locktab.AcquireOnName(ctx, g, arg.uid.String())

	defer func() {
		lock.Release(ctx)

		if !shouldReturnFullUser {
			user = nil
		}
		if user != nil && err == nil {
			// Update the full-self cacher after the lock is released, to avoid
			// any circular locking.
			if fs := g.GetFullSelfer(); fs != nil && arg.self {
				_ = fs.Update(ctx, user)
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
			fin := tbs.Record("CachedUPAKLoader.DeepCopy")
			tmp := upak.DeepCopy()
			upak = &tmp
			fin()
		}
		return upak, user, nil
	}

	var upak *keybase1.UserPlusKeysV2AllIncarnations
	var fresh bool

	if !arg.forceReload {
		upak, fresh = u.getCachedUPAK(ctx, arg.uid, arg.stubMode, info)
	}

	// cached UPAK is fresh or allowed to be stale, and we're not forcing a poll.
	if upak != nil && !arg.forcePoll && (fresh || arg.staleOK) {
		return returnUPAK(upak, true)
	}

	// If we had a cached UPAK we could return, we'd have already returned it.
	if arg.cachedOnly {
		var message string
		if upak == nil {
			message = "no cached user found"
		} else {
			message = "cached user found, but it was stale, and cached only"
		}
		return nil, nil, UserNotFoundError{UID: arg.uid, Msg: message}
	}

	if upak != nil {
		// At this point, we have a cached UPAK but we are not confident about whether we can return it.
		// Ask the server whether it is fresh.

		if arg.forcePoll {
			g.VDL.CLogf(ctx, VLog0, "%s: force-poll required us to repoll (fresh=%v)", culDebug(arg.uid), fresh)
		}

		if info != nil {
			info.TimedOut = true
		}

		var sigHints *SigHints
		var leaf *MerkleUserLeaf

		sigHints, leaf, err = lookupSigHintsAndMerkleLeaf(m, arg.uid, true, arg.ToMerkleOpts())
		if err != nil {
			if arg.staleOK {
				g.VDL.CLogf(ctx, VLog0, "Got error %+v when checking for staleness; using cached UPAK", err)
				return returnUPAK(upak, true)
			}
			return nil, nil, err
		}

		if info != nil {
			info.LoadedLeaf = true
		}

		if leaf.eldest == "" {
			g.VDL.CLogf(ctx, VLog0, "%s: cache-hit; but user is nuked, evicting", culDebug(arg.uid))

			// Our cached user turned out to be in reset state (without
			// current sigchain), remove from cache, and then fall
			// through. LoadUser shall return an error, which we will
			// return to the caller.
			u.removeMemCache(ctx, arg.uid, arg.stubMode)

			err := u.G().LocalDb.Delete(culDBKeyV2(arg.uid, arg.stubMode))
			if err != nil {
				u.G().Log.Warning("Failed to remove %s from disk cache: %s", arg.uid, err)
			}
			u.deleteV1UPAK(arg.uid)
		} else if leaf.public != nil && leaf.public.Seqno == keybase1.Seqno(upak.Uvv.SigChain) {
			g.VDL.CLogf(ctx, VLog0, "%s: cache-hit; fresh after poll", culDebug(arg.uid))

			upak.Uvv.CachedAt = keybase1.ToTime(g.Clock().Now())
			// This is only necessary to update the levelDB representation,
			// since the previous line updates the in-memory cache satisfactorily.
			if err := u.putUPAKToCache(ctx, upak, arg.stubMode); err != nil {
				u.G().Log.CDebugf(ctx, "continuing past error in putUPAKToCache: %s", err)
			}

			return returnUPAK(upak, true)
		}

		if info != nil {
			info.StaleVersion = true
		}
		arg.sigHints = sigHints
		arg.merkleLeaf = leaf
	}

	g.VDL.CLogf(ctx, VLog0, "%s: LoadUser", culDebug(arg.uid))
	user, err = LoadUser(arg)
	if info != nil {
		info.LoadedUser = true
	}

	if user != nil {
		// The `err` value might be non-nil above! Don't overwrite it.
		var exportErr error
		ret, exportErr = user.ExportToUPKV2AllIncarnations()
		if exportErr != nil {
			return nil, nil, exportErr
		}
		ret.Uvv.CachedAt = keybase1.ToTime(g.Clock().Now())
	}

	// In some cases, it's OK to have a user object and an error. This comes up in
	// Identify2 when identifying users who don't have a sigchain. Note that we'll never
	// hit the cache in this case (for now...)
	//
	// Additionally, we might have an error, a cached UPAK, no user object. If
	// stale is OK, we'll just return the stale data instead of the error.
	if err != nil {
		if upak != nil && arg.staleOK {
			g.VDL.CLogf(ctx, VLog0, "Got error %+v when fetching UPAK, so using cached data", err)
			return returnUPAK(upak, true)
		}
		return ret, user, err
	}

	if user == nil {
		return nil, nil, UserNotFoundError{UID: arg.uid, Msg: "LoadUser failed"}
	}

	if err := u.putUPAKToCache(ctx, ret, arg.stubMode); err != nil {
		m.Debug("continuing past error in putUPAKToCache: %s", err)
	}

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

	// NOTE -- it's OK to return an error and a user, since certain code paths
	// want both (see note in loadWithInfo).
	var converted *keybase1.UserPlusAllKeys
	if ret != nil {
		tmp := keybase1.UPAKFromUPKV2AI(*ret)
		converted = &tmp
	}

	return converted, user, err
}

// Load a UserPlusKeysV2AllIncarnations from the local cache, falls back to
// LoadUser, and cache the user. Can only perform lookups by UID. Will return a
// non-nil UserPlusKeysV2AllIncarnations, or a non-nil error, but never both
// non-nil, nor never both nil. If we had to do a full LoadUser as part of the
// request, it's returned too.
func (u *CachedUPAKLoader) LoadV2(arg LoadUserArg) (*keybase1.UserPlusKeysV2AllIncarnations, *User, error) {
	m, tbs := arg.m.WithTimeBuckets()
	arg.m = m
	defer tbs.Record("CachedUPAKLoader.LoadV2")()
	return u.loadWithInfo(arg, nil, nil, true)
}

func (u *CachedUPAKLoader) CheckKIDForUID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, deleted bool, err error) {

	var info CachedUserLoadInfo
	larg := NewLoadUserByUIDArg(ctx, u.G(), uid).WithPublicKeyOptional()
	upak, _, err := u.loadWithInfo(larg, &info, nil, false)

	if err != nil {
		return false, nil, false, err
	}
	found, revokedAt, deleted = CheckKID(upak, kid)
	if found || info.LoadedLeaf || info.LoadedUser {
		return found, revokedAt, deleted, nil
	}
	larg = larg.WithForceReload()
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

	arg := NewLoadUserArg(u.G()).WithUID(uid).WithPublicKeyOptional().WithNetContext(ctx)
	forcePollValues := []bool{false, true}

	for _, fp := range forcePollValues {

		arg = arg.WithForcePoll(fp)

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

// LoadKeyV2 looks through all incarnations for the user and returns the incarnation with the given
// KID, as well as the Key data associated with that KID. It picks the latest such
// incarnation if there are multiple.
func (u *CachedUPAKLoader) LoadKeyV2(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (ret *keybase1.UserPlusKeysV2,
	upak *keybase1.UserPlusKeysV2AllIncarnations, key *keybase1.PublicKeyV2NaCl, err error) {
	ctx = WithLogTag(ctx, "LK") // Load key
	defer u.G().CVTraceTimed(ctx, VLog0, fmt.Sprintf("LoadKeyV2 uid:%s,kid:%s", uid, kid), func() error { return err })()
	ctx, tbs := u.G().CTimeBuckets(ctx)
	defer tbs.Record("CachedUPAKLoader.LoadKeyV2")()
	if uid.IsNil() {
		return nil, nil, nil, NoUIDError{}
	}

	argBase := NewLoadUserArg(u.G()).WithUID(uid).WithPublicKeyOptional().WithNetContext(ctx)

	// Make the retry mechanism increasingly aggressive. See CORE-8851.
	// It should be that a ForcePoll is good enough, but in some rare cases,
	// people have cached values for previous pre-reset user incarnations that
	// were incorrect. So clobber over that if it comes to it.
	attempts := []LoadUserArg{
		argBase,
		argBase.WithForcePoll(true),
		argBase.WithForceReload(),
	}

	for i, arg := range attempts {

		if i > 0 {
			u.G().VDL.CLogf(ctx, VLog0, "| reloading with arg: %s", arg.String())
		}

		upak, _, err := u.LoadV2(arg)
		if err != nil {
			return nil, nil, nil, err
		}
		if upak == nil {
			return nil, nil, nil, fmt.Errorf("Nil user, nil error from LoadUser")
		}

		ret, key := upak.FindKID(kid)
		if key != nil {
			u.G().VDL.CLogf(ctx, VLog1, "- found kid in UPAK: %v", ret.Uid)
			return ret, upak, key, nil
		}
	}

	return nil, nil, nil, NotFoundError{Msg: "Not found: Key for user"}
}

func (u *CachedUPAKLoader) markStale(ctx context.Context, uid keybase1.UID, mode StubMode) (err error) {
	u.G().VDL.CLogf(ctx, VLog0, "| CachedUPAKLoader#markStale(%s,%v)", uid, mode)
	obj := u.getCachedUPAKFromDB(ctx, uid, mode)
	if obj == nil {
		u.G().VDL.CLogf(ctx, VLog0, "| markStale: cached user object not found")
		return nil
	}
	obj.Stale = true
	err = u.putUPAKToDB(ctx, uid, mode, *obj)
	return err
}

func (u *CachedUPAKLoader) Invalidate(ctx context.Context, uid keybase1.UID) {

	u.G().VDL.CLogf(ctx, VLog0, "| CachedUPAKLoader#Invalidate(%s)", uid)

	if u.noCache {
		return
	}

	lock := u.locktab.AcquireOnName(ctx, u.G(), uid.String())
	defer lock.Release(ctx)

	for _, sm := range []StubMode{StubModeStubbed, StubModeUnstubbed} {
		err := u.markStale(ctx, uid, sm)
		if err != nil {
			u.G().Log.CWarningf(ctx, "Failed to remove %s from disk cache: %s", uid, err)
		}
	}

	// Do this after invalidation, since loading upaks from DB puts them into memory
	u.removeMemCache(ctx, uid, StubModeUnstubbed)
	u.removeMemCache(ctx, uid, StubModeStubbed)

	u.deleteV1UPAK(uid)
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
	larg = larg.WithForcePoll(true)
	upakV2, _, err = u.loadWithInfo(larg, nil, nil, false)
	if err != nil {
		return nil, nil, nil, err
	}
	upakV1 = keybase1.UPAKFromUPKV2AI(*upakV2)

	deviceKey, revoked, err = u.extractDeviceKey(upakV1, deviceID)
	return &upakV1, deviceKey, revoked, err
}

// If the user exists but the device doesn't, will force a load in case the device is very new.
func (u *CachedUPAKLoader) LoadUPAKWithDeviceID(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (*keybase1.UserPlusKeysV2AllIncarnations, error) {
	var info CachedUserLoadInfo
	larg := NewLoadUserByUIDArg(ctx, u.G(), uid).WithPublicKeyOptional()
	upakV2, _, err := u.loadWithInfo(larg, &info, nil, false)
	if err != nil {
		return nil, err
	}

	for _, device := range upakV2.Current.DeviceKeys {
		if device.DeviceID.Eq(deviceID) {
			// Early success, return
			return upakV2, nil
		}
	}

	// Try again with a forced load in case the device is very new.
	larg = larg.WithForcePoll(true)
	upakV2, _, err = u.loadWithInfo(larg, nil, nil, false)
	if err != nil {
		return nil, err
	}
	return upakV2, nil
}

// LookupUsername uses the UIDMapper to find a username for uid.
func (u *CachedUPAKLoader) LookupUsername(ctx context.Context, uid keybase1.UID) (NormalizedUsername, error) {
	var empty NormalizedUsername
	uids := []keybase1.UID{uid}
	namePkgs, err := u.G().UIDMapper.MapUIDsToUsernamePackages(ctx, u.G(), uids, 0, 0, false)
	if err != nil {
		return empty, err
	}
	if len(namePkgs) == 0 {
		return empty, UserNotFoundError{UID: uid, Msg: "in CachedUPAKLoader"}
	}

	if u.TestDeadlocker != nil {
		u.TestDeadlocker()
	}

	return namePkgs[0].NormalizedUsername, nil
}

// LookupUsernameUPAK uses the upak loader to find a username for uid.
func (u *CachedUPAKLoader) LookupUsernameUPAK(ctx context.Context, uid keybase1.UID) (NormalizedUsername, error) {
	var info CachedUserLoadInfo
	arg := NewLoadUserByUIDArg(ctx, u.G(), uid).WithStaleOK(true).WithPublicKeyOptional()
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

// LookupUID is a verified map of username -> UID. IT calls into the resolver, which gives un untrusted
// UID, but verifies with the UPAK loader that the mapping UID -> username is correct.
func (u *CachedUPAKLoader) LookupUID(ctx context.Context, un NormalizedUsername) (keybase1.UID, error) {
	m := NewMetaContext(ctx, u.G())
	rres := u.G().Resolver.Resolve(m, un.String())
	if err := rres.GetError(); err != nil {
		return keybase1.UID(""), err
	}
	un2, err := u.LookupUsername(ctx, rres.GetUID())
	if err != nil {
		return keybase1.UID(""), err
	}
	if !un.Eq(un2) {
		m.Warning("Unexpected mismatched usernames (uid=%s): %s != %s", rres.GetUID(), un.String(), un2.String())
		return keybase1.UID(""), NewBadUsernameError(un.String())
	}
	return rres.GetUID(), nil
}

func (u *CachedUPAKLoader) lookupUsernameAndDeviceWithInfo(ctx context.Context, uid keybase1.UID, did keybase1.DeviceID, info *CachedUserLoadInfo) (username NormalizedUsername, deviceName string, deviceType string, err error) {
	arg := NewLoadUserByUIDArg(ctx, u.G(), uid)

	// First iteration through, say it's OK to load a stale user. Note that the
	// mappings of UID to Username and DeviceID to DeviceName are immutable, so this
	// data can never be stale. However, our user might be out of date and lack the
	// mappings, so the second time through, we request a fresh object.
	staleOK := []bool{true, false}
	for _, b := range staleOK {
		arg = arg.WithStaleOK(b)
		found := false
		_, _, err := u.loadWithInfo(arg, info, func(upak *keybase1.UserPlusKeysV2AllIncarnations) error {
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
		if err != nil {
			return NormalizedUsername(""), "", "", err
		}
		if found {
			return username, deviceName, deviceType, nil
		}
	}
	err = NotFoundError{fmt.Sprintf("UID/Device pair %s/%s not found", uid, did)}
	return NormalizedUsername(""), "", "", err
}

func (u *CachedUPAKLoader) CheckDeviceForUIDAndUsername(ctx context.Context, uid keybase1.UID, did keybase1.DeviceID, n NormalizedUsername, suppressNetworkErrs bool) (err error) {
	arg := NewLoadUserByUIDArg(ctx, u.G(), uid).WithForcePoll(true).WithPublicKeyOptional().WithStaleOK(suppressNetworkErrs)
	foundUser := false
	foundDevice := false
	isRevoked := false
	var foundUsername NormalizedUsername
	_, _, err = u.loadWithInfo(arg, nil, func(upak *keybase1.UserPlusKeysV2AllIncarnations) error {
		if upak == nil {
			return nil
		}
		foundUser = true
		foundUsername = NewNormalizedUsername(upak.Current.Username)
		if pk := upak.FindDevice(did); pk != nil {
			foundDevice = true
			if pk.Base.Revocation != nil {
				isRevoked = true
			}
		}
		return nil
	}, false)
	if err != nil {
		return err
	}
	if !foundUser {
		return UserNotFoundError{UID: uid}
	}
	if !foundDevice {
		return DeviceNotFoundError{Where: "UPAKLoader", ID: did, Loaded: false}
	}
	if isRevoked {
		return NewKeyRevokedError(did.String())
	}
	if !n.IsNil() && !foundUsername.Eq(n) {
		return LoggedInWrongUserError{ExistingName: foundUsername, AttemptedName: n}
	}
	return nil
}

func (u *CachedUPAKLoader) loadUserWithKIDAndInfo(ctx context.Context, uid keybase1.UID, kid keybase1.KID, info *CachedUserLoadInfo) (ret *keybase1.UserPlusKeysV2AllIncarnations, err error) {
	argBase := NewLoadUserArg(u.G()).WithUID(uid).WithPublicKeyOptional().WithNetContext(ctx)

	// See comment in LoadKeyV2
	attempts := []LoadUserArg{
		argBase,
		argBase.WithForcePoll(true),
		argBase.WithForceReload(),
	}
	for _, arg := range attempts {
		u.G().VDL.CLogf(ctx, VLog0, "| loadWithUserKIDAndInfo: loading with arg: %s", arg.String())
		ret, _, err = u.loadWithInfo(arg, info, nil, false)
		if err == nil && ret != nil && (kid.IsNil() || ret.HasKID(kid)) {
			u.G().VDL.CLogf(ctx, VLog0, "| loadWithUserKIDAndInfo: UID/KID %s/%s found", uid, kid)
			return ret, nil
		}
	}
	if err == nil {
		err = NotFoundError{fmt.Sprintf("UID/KID pair %s/%s not found", uid, kid)}
	}
	return nil, err
}

func (u *CachedUPAKLoader) LoadV2WithKID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (*keybase1.UserPlusKeysV2AllIncarnations, error) {
	return u.loadUserWithKIDAndInfo(ctx, uid, kid, nil)
}

func (u *CachedUPAKLoader) LookupUsernameAndDevice(ctx context.Context, uid keybase1.UID, did keybase1.DeviceID) (username NormalizedUsername, deviceName string, deviceType string, err error) {
	return u.lookupUsernameAndDeviceWithInfo(ctx, uid, did, nil)
}

func (u *CachedUPAKLoader) ListFollowedUIDs(ctx context.Context, uid keybase1.UID) ([]keybase1.UID, error) {
	arg := NewLoadUserByUIDArg(ctx, u.G(), uid)
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

// v1 UPAKs are all legacy and need to be gradually cleaned from cache.
func (u *CachedUPAKLoader) deleteV1UPAK(uid keybase1.UID) {
	err := u.G().LocalDb.Delete(culDBKeyV1(uid))
	if err != nil {
		u.G().Log.Warning("Failed to remove %s v1 object from disk cache: %s", uid, err)
	}
}

func memCacheKey(u keybase1.UID, stubMode StubMode) string {
	return fmt.Sprintf("%s-%s", u, stubMode)
}

func (u *CachedUPAKLoader) getMemCache(ctx context.Context, uid keybase1.UID, stubMode StubMode) *keybase1.UserPlusKeysV2AllIncarnations {
	val, ok := u.cache.Get(memCacheKey(uid, stubMode))
	if !ok {
		return nil
	}

	upak, ok := val.(keybase1.UserPlusKeysV2AllIncarnations)
	if !ok {
		u.G().Log.CWarningf(ctx, "invalid type in upak cache: %T", val)
		return nil
	}

	return &upak
}

func (u *CachedUPAKLoader) putMemCache(ctx context.Context, uid keybase1.UID, stubMode StubMode, upak keybase1.UserPlusKeysV2AllIncarnations) {
	u.cache.Add(memCacheKey(uid, stubMode), upak)
}

func (u *CachedUPAKLoader) removeMemCache(ctx context.Context, uid keybase1.UID, stubMode StubMode) {
	u.cache.Remove(memCacheKey(uid, stubMode))
}

func (u *CachedUPAKLoader) purgeMemCache() {
	u.cache.Purge()
}

func checkDeviceValidForUID(ctx context.Context, u UPAKLoader, uid keybase1.UID, did keybase1.DeviceID) error {
	var nnu NormalizedUsername
	return u.CheckDeviceForUIDAndUsername(ctx, uid, did, nnu, false)
}

func CheckCurrentUIDDeviceID(m MetaContext) (err error) {
	defer m.Trace("CheckCurrentUIDDeviceID", func() error { return err })()
	uid := m.G().Env.GetUID()
	if uid.IsNil() {
		return NoUIDError{}
	}
	did := m.G().Env.GetDeviceIDForUID(uid)
	if did.IsNil() {
		return NoDeviceError{fmt.Sprintf("for UID %s", uid)}
	}
	return checkDeviceValidForUID(m.Ctx(), m.G().GetUPAKLoader(), uid, did)
}

// Batcher loads a batch of UPAKs with the given window width. It keeps calling getArg(i) with an
// increasing i, until that getArg return nil, in which case the production of UPAK loads is over.
// UPAKs will be loaded and fed into processResult() as they come in. Both getArg() and processResult()
// are called in the same mutex to simplify synchronization.
func (u *CachedUPAKLoader) Batcher(
	ctx context.Context,
	getArg func(int) *LoadUserArg,
	processResult func(int, *keybase1.UserPlusKeysV2AllIncarnations) error,
	ignoreError func(error) bool,
	window int,
) (err error) {
	if window == 0 {
		window = 10
	}

	ctx = WithLogTag(ctx, "LUB")
	eg, ctx := errgroup.WithContext(ctx)
	defer u.G().CTrace(ctx, "CachedUPAKLoader#Batcher", func() error { return err })()

	type argWithIndex struct {
		i   int
		arg LoadUserArg
	}
	args := make(chan argWithIndex)
	var mut sync.Mutex

	// Make a stream of args, and send them down the channel
	var stopBatch bool
	eg.Go(func() error {
		defer close(args)
		for i := 0; !stopBatch; i++ {
			mut.Lock()
			arg := getArg(i)
			mut.Unlock()
			if arg == nil {
				return nil
			}
			select {
			case args <- argWithIndex{i, arg.WithNetContext(ctx)}:
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		return nil
	})

	for i := 0; i < window; i++ {
		eg.Go(func() (err error) {
			// If we receive an error, kill the pipeline
			defer func() {
				if err != nil {
					mut.Lock()
					defer mut.Unlock()
					u.G().Log.CDebugf(ctx, "CachedUPAKLoader#Batcher unable to complete batch: %v, setting stopBatch=true", err)
					stopBatch = true
				}
			}()
			for awi := range args {
				arg := awi.arg
				_, _, err = u.loadWithInfo(arg, nil, func(u *keybase1.UserPlusKeysV2AllIncarnations) error {
					if processResult != nil {
						mut.Lock()
						err = processResult(awi.i, u)
						mut.Unlock()
						if err != nil {
							return err
						}
					}
					return nil
				}, false)
				// If the UPAK load errors out, it won't get to processResult
				// in CachedUPAKLoader#loadWithInfo. In case that's fine, don't
				// return an error so as not to stop the batch.
				if err != nil && (ignoreError == nil || !ignoreError(err)) {
					return err
				}
			}
			return nil
		})
	}

	return eg.Wait()
}
