package libkb

import (
	"errors"
	"fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"sync"
	"time"
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
	diff := u.G().Clock().Now().Sub(keybase1.FromTime(upk.Base.Uvv.CachedAt))
	fresh := (diff <= u.Freshness)
	if fresh {
		u.G().Log.Debug("| cache hit was fresh (cached %s ago)", diff)
	} else {
		u.G().Log.Debug("| cache hit was stale (by %s)", u.Freshness-diff)
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
	}

	if upk != nil {

		var sigHints *SigHints
		sigHints, err = LoadSigHints(arg.UID, u.G())
		if err != nil {
			return nil, nil, err
		}

		var leaf *MerkleUserLeaf
		leaf, err = lookupMerkleLeaf(u.G(), arg.UID, true, sigHints)
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
	if err != nil {
		return nil, nil, err
	}

	tmp := user.ExportToUserPlusAllKeys(keybase1.Time(0))
	ret = &tmp
	ret.Base.Uvv.CachedAt = keybase1.ToTime(u.G().Clock().Now())
	u.Lock()
	u.m[arg.UID.String()] = ret
	u.Unlock()

	return ret, user, nil
}

func (u *CachedUserLoader) Load(arg LoadUserArg) (ret *keybase1.UserPlusAllKeys, user *User, err error) {
	return u.loadWithInfo(arg, nil)
}

func (u *CachedUserLoader) CheckKIDForUID(uid keybase1.UID, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, err error) {

	var info CachedUserLoadInfo
	upk, _, err := u.loadWithInfo(NewLoadUserByUIDArg(u.G(), uid), &info)
	if err != nil {
		return false, nil, err
	}
	if upk == nil {
		return false, nil, UserNotFoundError{UID: uid, Msg: "cachedUserLoad failed"}
	}

	found, revokedAt = CheckKID(upk, kid)
	if found || info.LoadedLeaf || info.LoadedUser {
		return found, revokedAt, nil
	}
	upk, _, err = u.loadWithInfo(NewLoadUserByUIDForceArg(u.G(), uid), nil)
	if err != nil {
		return false, nil, err
	}
	if upk == nil {
		return false, nil, UserNotFoundError{UID: uid, Msg: "cachedUserLoad failed (2nd time)"}
	}
	found, revokedAt = CheckKID(upk, kid)
	return found, revokedAt, nil
}
