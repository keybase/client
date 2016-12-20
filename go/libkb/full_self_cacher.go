package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"sync"
)

// FullSelfCacher caches a full-on *User for the "me" or "self" user.
// Because it's a full-on *User, it contains many pointers and can't
// reasonably be deep-copied. So we're going to insist that access to the
// cached user is protected inside a lock.
type FullSelfCacher struct {
	Contextified
	sync.Mutex
	me *User
}

// NewFullSelfCacher makes a new full self cacher in the given GlobalContext
func NewFullSelfCacher(g *GlobalContext) *FullSelfCacher {
	return &FullSelfCacher{
		Contextified: NewContextified(g),
	}
}

func (m *FullSelfCacher) isSelfLoad(arg LoadUserArg) bool {
	if arg.Self {
		return true
	}
	if arg.Name != "" && NewNormalizedUsername(arg.Name).Eq(m.me.GetNormalizedName()) {
		return true
	}
	if arg.UID.Exists() && arg.UID.Equal(m.me.GetUID()) {
		return true
	}
	return false
}

// WithSelf loads only the self user, and maybe hits the cache.
// It takes a closure, in which the user object is locked and accessible,
// but we should be sure the user never escapes this closure. If the user
// is fresh-loaded, then it is stored in memory.
func (m *FullSelfCacher) WithSelf(f func(u *User) error) error {
	arg := LoadUserArg{
		Contextified:      NewContextified(m.G()),
		PublicKeyOptional: true,
		Self:              true,
	}
	return m.WithUser(arg, f)
}

// WithUser loads any old user. If it happens to be the self user, then it behaves
// as in WithSelf. Otherwise, it will just load the user, and throw it out when done.
// WithUser supports other so that code doesn't need to change if we're doing the
// operation for the user or someone else.
func (m *FullSelfCacher) WithUser(arg LoadUserArg, f func(u *User) error) (err error) {
	id, _ := RandString("", 10)

	m.G().Log.Debug("+ FullSelfCacher#WithUser[%s]: %+v", id, arg)
	m.Lock()

	defer func() {
		m.G().Log.Debug("- FullSelfCacher#WithUser[%s]", id)
		m.Unlock()
	}()

	var u *User

	if m.me == nil || !m.isSelfLoad(arg) {
		u, err = LoadUser(arg)
		if err != nil {
			return err
		}
		// WARNING! You can't call m.G().GetMyUID() if this function is called from
		// within the Account/LoginState inner loop. Because m.G().GetMyUID() calls
		// back into Account, it will deadlock.
		if arg.Self || u.GetUID().Equal(m.G().GetMyUID()) {
			m.G().Log.Debug("| FullSelfCacher#WithUser[%s]: cache populate", id)
			m.me = u
		} else {
			m.G().Log.Debug("| FullSelfCacher#WithUser[%s]: other user", id)
		}
	} else {
		m.G().Log.Debug("| FullSelfCacher#WithUser[%s]: cache hit", id)
		u = m.me
	}
	return f(u)
}

// HandleUserChanged clears the cached self user if it's the UID of the self user.
func (m *FullSelfCacher) HandleUserChanged(u keybase1.UID) error {
	m.Lock()
	defer m.Unlock()
	if m.me != nil && m.me.GetUID().Equal(u) {
		m.G().Log.Debug("| Invalidating me for UID=%s", u)
		m.me = nil
	}
	return nil
}

// OnLogout clears the cached self user.
func (m *FullSelfCacher) OnLogout() error {
	m.Lock()
	defer m.Unlock()
	m.me = nil
	return nil
}

// OnLogin clears the cached self user if it differs from what's already cached.
func (m *FullSelfCacher) OnLogin() error {
	m.Lock()
	defer m.Unlock()
	if m.me != nil && !m.me.GetUID().Equal(m.G().GetMyUID()) {
		m.me = nil
	}
	return nil
}
