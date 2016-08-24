package libkb

import (
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type UserPlusKeysMemo struct {
	upk        keybase1.UserPlusKeys
	validUntil time.Time
	sync.RWMutex
	Contextified
}

func NewUserPlusKeysMemo(g *GlobalContext) *UserPlusKeysMemo {
	return &UserPlusKeysMemo{
		Contextified: NewContextified(g),
	}
}

func (u *UserPlusKeysMemo) Get(uid keybase1.UID) (keybase1.UserPlusKeys, bool) {
	u.RLock()
	defer u.RUnlock()

	if !u.upk.Uid.Equal(uid) {
		return keybase1.UserPlusKeys{}, false
	}

	if time.Now().Before(u.validUntil) {
		u.G().Log.Debug("UserPlusKeysMemo: cache expired")
		return keybase1.UserPlusKeys{}, false
	}

	u.G().Log.Debug("UserPlusKeysMemo: cache hit")

	return u.upk, true
}

func (u *UserPlusKeysMemo) Set(upk keybase1.UserPlusKeys) {
	u.Lock()
	defer u.Unlock()

	u.G().Log.Debug("UserPlusKeysMemo: set %s, %s", upk.Username, upk.Uid)

	u.upk = upk
	u.validUntil = time.Now().Add(1 * time.Minute)
}

func (u *UserPlusKeysMemo) Clear() {
	u.Lock()
	defer u.Unlock()

	u.G().Log.Debug("UserPlusKeysMemo: clear")

	u.upk = keybase1.UserPlusKeys{}
	u.validUntil = time.Time{}
}
