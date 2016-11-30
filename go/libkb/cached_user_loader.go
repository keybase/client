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

func (u *CachedUserLoader) getCachedUPK(uid keybase1.UID) (*keybase1.UserPlusAllKeys, bool) {
	u.Lock()
	defer u.Unlock()
	upk := u.m[uid.String()]
	if upk == nil {
		u.G().Log.Debug("| missed cached")
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
	TimedOut     bool
	StaleVersion bool
	LoadedLeaf   bool
	LoadedUser   bool
}

func (u *CachedUserLoader) Disable() {
	u.Freshness = time.Duration(0)
}

// loadWithInfo loads a user by UID from the CachedUserLoader object. The 'info'
// object contains information about how the request was handled, but otherwise,
// this method behaves like (and implements) the public CachedUserLoader#Load
// method below.
func (u *CachedUserLoader) loadWithInfo(arg LoadUserArg, info *CachedUserLoadInfo) (ret *keybase1.UserPlusAllKeys, user *User, err error) {
	defer u.G().Trace(fmt.Sprintf("CachedUserLoader#Load(%s)", arg.UID), func() error { return err })()

	if arg.UID.IsNil() {
		err = errors.New("need a UID to load UPK from loader")
		return nil, nil, err
	}

	lock := u.locktab.AcquireOnName(arg.UID.String())
	defer lock.Release()

	var upk *keybase1.UserPlusAllKeys
	var fresh bool

	if !arg.ForceReload {
		upk, fresh = u.getCachedUPK(arg.UID)
	}

	if upk != nil {
		if info != nil {
			info.InCache = true
		}
		if fresh {
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
			u.G().Log.Debug("| user was still fresh after check with merkle tree")
			upk.Base.Uvv.CachedAt = keybase1.ToTime(u.G().Clock().Now())
			return upk.DeepCopy(), nil, nil
		}

		if info != nil {
			info.StaleVersion = true
		}
		arg.SigHints = sigHints
		arg.MerkleLeaf = leaf
	}

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
	u.Lock()
	u.m[arg.UID.String()] = ret
	u.Unlock()

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
	arg.ForceReload = true

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
