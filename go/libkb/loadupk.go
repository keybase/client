package libkb

import (
	"errors"
	"fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"sync"
	"time"
)

type UserPlusAllKeysLoader struct {
	sync.Mutex
	Contextified
	m         map[string]*keybase1.UserPlusAllKeys
	locktab   LockTable
	Freshness time.Duration
}

func (u *UserPlusAllKeysLoader) getCachedUPK(uid keybase1.UID) (*keybase1.UserPlusAllKeys, bool) {
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

func (u *UserPlusAllKeysLoader) Load(arg LoadUserArg) (ret *keybase1.UserPlusAllKeys, user *User, err error) {
	u.G().Trace(fmt.Sprintf("UserPlusAllKeysLoader#Load(%s)", arg.UID), func() error { return err })

	if arg.UID.IsNil() {
		err = errors.New("need a UID to load UPK from loader")
		return nil, nil, err
	}

	lock := u.locktab.AcquireOnName(arg.UID.String())
	defer lock.Release()

	upk, fresh := u.getCachedUPK(arg.UID)
	if upk != nil && fresh {
		return upk.DeepCopy(), nil, nil
	}

	if upk != nil {

		var sigHints *SigHints
		sigHints, err = LoadSigHints(arg.UID, arg.G())
		if err != nil {
			return nil, nil, err
		}

		var leaf *MerkleUserLeaf
		leaf, err = lookupMerkleLeaf(u.G(), arg.UID, true, sigHints)
		if leaf.public != nil && leaf.public.Seqno == Seqno(upk.Base.Uvv.SigChain) {
			u.G().Log.Debug("| user was still fresh after check with merkle tree")
			upk.Base.Uvv.CachedAt = keybase1.ToTime(u.G().Clock().Now())
			return upk.DeepCopy(), nil, nil
		}

		arg.SigHints = sigHints
		arg.MerkleLeaf = leaf
	}

	user, err = LoadUser(arg)
	if err != nil {
		return nil, nil, err
	}

	tmp := user.ExportToUserPlusAllKeys(keybase1.Time(0))
	ret = &tmp
	u.Lock()
	u.m[arg.UID.String()] = ret
	u.Unlock()

	return ret, user, nil
}
