package libkb

import (
	"fmt"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type FullSelfer interface {
	WithSelf(ctx context.Context, f func(u *User) error) error
	WithSelfForcePoll(ctx context.Context, f func(u *User) error) error
	WithUser(arg LoadUserArg, f func(u *User) error) (err error)
	HandleUserChanged(u keybase1.UID) error
	Update(ctx context.Context, u *User) error
	New() FullSelfer
	OnLogin() error
}

type UncachedFullSelf struct {
	Contextified
}

var _ FullSelfer = (*UncachedFullSelf)(nil)

func (n *UncachedFullSelf) WithSelf(ctx context.Context, f func(u *User) error) error {
	arg := NewLoadUserArg(n.G()).WithPublicKeyOptional().WithSelf(true).WithNetContext(ctx)
	return n.WithUser(arg, f)
}

func (n *UncachedFullSelf) WithSelfForcePoll(ctx context.Context, f func(u *User) error) error {
	arg := NewLoadUserArg(n.G()).WithPublicKeyOptional().WithSelf(true).WithNetContext(ctx).WithForcePoll(true)
	return n.WithUser(arg, f)
}

func (n *UncachedFullSelf) WithUser(arg LoadUserArg, f func(u *User) error) error {
	u, err := LoadUser(arg)
	if err != nil {
		return err
	}
	return f(u)
}

func (n *UncachedFullSelf) HandleUserChanged(u keybase1.UID) error    { return nil }
func (n *UncachedFullSelf) OnLogin() error                            { return nil }
func (n *UncachedFullSelf) Update(ctx context.Context, u *User) error { return nil }

func (n *UncachedFullSelf) New() FullSelfer { return NewUncachedFullSelf(n.G()) }

func NewUncachedFullSelf(g *GlobalContext) *UncachedFullSelf {
	return &UncachedFullSelf{NewContextified(g)}
}

// CachedFullSelf caches a full-on *User for the "me" or "self" user.
// Because it's a full-on *User, it contains many pointers and can't
// reasonably be deep-copied. So we're going to insist that access to the
// cached user is protected inside a lock.
type CachedFullSelf struct {
	Contextified
	sync.Mutex
	me             *User
	cachedAt       time.Time
	TestDeadlocker func()
}

var _ FullSelfer = (*CachedFullSelf)(nil)

// NewCachedFullSelf makes a new full self cacher in the given GlobalContext
func NewCachedFullSelf(g *GlobalContext) *CachedFullSelf {
	return &CachedFullSelf{
		Contextified: NewContextified(g),
	}
}

func (m *CachedFullSelf) New() FullSelfer { return NewCachedFullSelf(m.G()) }

func (m *CachedFullSelf) isSelfLoad(arg LoadUserArg) bool {
	if arg.self {
		return true
	}
	if arg.name != "" && NewNormalizedUsername(arg.name).Eq(m.me.GetNormalizedName()) {
		return true
	}
	if arg.uid.Exists() && arg.uid.Equal(m.me.GetUID()) {
		return true
	}
	return false
}

// WithSelf loads only the self user, and maybe hits the cache.
// It takes a closure, in which the user object is locked and accessible,
// but we should be sure the user never escapes this closure. If the user
// is fresh-loaded, then it is stored in memory.
func (m *CachedFullSelf) WithSelf(ctx context.Context, f func(u *User) error) error {
	arg := NewLoadUserArg(m.G()).WithPublicKeyOptional().WithSelf(true).WithNetContext(ctx)
	return m.WithUser(arg, f)
}

// WithSelfForcePoll is like WithSelf but forces a poll. I.e., it will always go to the server for
// a merkle check, regardless of when the existing self was cached.
func (m *CachedFullSelf) WithSelfForcePoll(ctx context.Context, f func(u *User) error) error {
	arg := NewLoadUserArg(m.G()).WithPublicKeyOptional().WithSelf(true).WithNetContext(ctx).WithForcePoll(true)
	return m.WithUser(arg, f)
}

func (m *CachedFullSelf) maybeClearCache(ctx context.Context, arg *LoadUserArg) (err error) {
	defer m.G().CTrace(ctx, "CachedFullSelf#maybeClearCache", func() error { return err })()

	now := m.G().Clock().Now()
	diff := now.Sub(m.cachedAt)

	if diff < CachedUserTimeout && !arg.forcePoll {
		m.G().Log.CDebugf(ctx, "| was fresh, last loaded %s ago", diff)
		return nil
	}

	var sigHints *SigHints
	var leaf *MerkleUserLeaf

	sigHints, leaf, err = lookupSigHintsAndMerkleLeaf(ctx, m.G(), arg.uid, true)
	if err != nil {
		m.me = nil
		return err
	}

	arg.sigHints = sigHints
	arg.merkleLeaf = leaf

	var idVersion int64

	if idVersion, err = m.me.GetIDVersion(); err != nil {
		m.me = nil
		return err
	}

	if leaf.public != nil && leaf.public.Seqno == m.me.GetSigChainLastKnownSeqno() && leaf.idVersion == idVersion {
		m.G().Log.CDebugf(ctx, "| CachedFullSelf still fresh at seqno=%d, idVersion=%d", leaf.public.Seqno, leaf.idVersion)
		return nil
	}

	m.G().Log.CDebugf(ctx, "| CachedFullSelf was out of date")
	m.me = nil

	return nil
}

// WithUser loads any old user. If it happens to be the self user, then it behaves
// as in WithSelf. Otherwise, it will just load the user, and throw it out when done.
// WithUser supports other so that code doesn't need to change if we're doing the
// operation for the user or someone else.
func (m *CachedFullSelf) WithUser(arg LoadUserArg, f func(u *User) error) (err error) {
	ctx := arg.netContext
	if ctx == nil {
		ctx = context.Background()
	}
	ctx = WithLogTag(ctx, "SELF")
	arg = arg.WithNetContext(ctx)

	m.G().Log.CDebugf(ctx, "+ CachedFullSelf#WithUser(%+v)", arg)
	m.Lock()

	defer func() {
		m.G().Log.CDebugf(ctx, "- CachedFullSelf#WithUser")
		m.Unlock()
	}()

	var u *User

	if m.me != nil && m.isSelfLoad(arg) {
		m.maybeClearCache(ctx, &arg)
	}

	if m.me == nil || !m.isSelfLoad(arg) {

		if m.TestDeadlocker != nil {
			m.TestDeadlocker()
		}

		u, err = LoadUser(arg)

		if err != nil {
			return err
		}
		// WARNING! You can't call m.G().GetMyUID() if this function is called from
		// within the Account/LoginState inner loop. Because m.G().GetMyUID() calls
		// back into Account, it will deadlock.
		if arg.self || u.GetUID().Equal(m.G().GetMyUID()) {
			m.G().Log.CDebugf(ctx, "| CachedFullSelf#WithUser: cache populate")
			m.cacheMe(u)
			if ldr := m.G().GetUPAKLoader(); ldr != nil {
				if err := ldr.PutUserToCache(ctx, u); err != nil {
					m.G().Log.CDebugf(ctx, "| CachedFullSelf#WithUser: continuing past error putting user to cache: %s", err)
				}
			}
		} else {
			m.G().Log.CDebugf(ctx, "| CachedFullSelf#WithUser: other user")
		}
	} else {
		m.G().Log.CDebugf(ctx, "| CachedFullSelf#WithUser: cache hit")
		u = m.me
	}
	return f(u)
}

func (m *CachedFullSelf) cacheMe(u *User) {
	m.me = u
	m.cachedAt = m.G().Clock().Now()
}

// Update updates the CachedFullSelf with a User loaded from someplace else -- let's
// say the UPAK loader. We throw away objects for other users or that aren't newer than
// the one we have.
//
// CALLER BEWARE! You must only provide this function with a user you know to be "self".
// This function will not do any checking along those lines (see comment below).
func (m *CachedFullSelf) Update(ctx context.Context, u *User) (err error) {

	// NOTE(max) 20171101: We used to do this:
	//
	//   if !u.GetUID().Equal(m.G().GetMyUID()) {
	//   	return
	//   }
	//
	// BUT IT IS DEADLY! The problem is that m.G().GetMyUID() calls into LoginState, but often
	// we're being called from a LoginState context, so we get a circular locking situation.
	// So the onus is on the caller to check that we're actually loading self.

	defer m.G().CTrace(ctx, fmt.Sprintf("CachedFullSelf#Update(%s)", u.GetUID()), func() error { return err })()
	m.Lock()
	defer m.Unlock()

	if m.me == nil {
		m.G().Log.CDebugf(ctx, "Updating user, since our copy was null")
		m.cacheMe(u)
	} else {
		var newer bool
		newer, err = u.IsNewerThan(m.me)
		if err != nil {
			return err
		}
		if newer {
			m.G().Log.CDebugf(ctx, "Updating user, since we got a newer copy")
			m.cacheMe(u)
		} else {
			m.G().Log.CDebugf(ctx, "CachedFullSelf#Update called with older user")
		}
	}
	return nil
}

// HandleUserChanged clears the cached self user if it's the UID of the self user.
func (m *CachedFullSelf) HandleUserChanged(u keybase1.UID) error {
	m.Lock()
	defer m.Unlock()
	if m.me != nil && m.me.GetUID().Equal(u) {
		m.G().Log.Debug("| CachedFullSelf#HandleUserChanged: Invalidating me for UID=%s", u)
		m.me = nil
	} else {
		m.G().Log.Debug("| CachedFullSelf#HandleUserChanged: Ignoring cache bust for UID=%s", u)
	}
	return nil
}

// OnLogin clears the cached self user if it differs from what's already cached.
func (m *CachedFullSelf) OnLogin() error {
	m.Lock()
	defer m.Unlock()
	if m.me != nil && !m.me.GetUID().Equal(m.G().GetMyUID()) {
		m.me = nil
	}
	return nil
}

func LoadSelfForTeamSignatures(ctx context.Context, g *GlobalContext) (ret UserForSignatures, err error) {
	err = g.GetFullSelfer().WithSelf(ctx, func(u *User) error {
		if u == nil {
			return LoginRequiredError{"no self in FullSelfCacher"}
		}
		ret = u.ToUserForSignatures()
		return nil
	})
	return ret, err
}
