package libkb

import (
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

type LoadUserArg struct {
	UID               keybase1.UID
	Name              string // Can also be an assertion like foo@twitter
	PublicKeyOptional bool
	NoCacheResult     bool // currently ignore
	Self              bool
	ForceReload       bool
	AllKeys           bool
	LoginContext      LoginContext
	Contextified
}

func NewLoadUserArg(g *GlobalContext) LoadUserArg {
	return LoadUserArg{Contextified: NewContextified(g)}
}

func NewLoadUserForceArg(g *GlobalContext) LoadUserArg {
	arg := NewLoadUserArg(g)
	arg.ForceReload = true
	return arg
}

func NewLoadUserByNameArg(g *GlobalContext, name string) LoadUserArg {
	arg := NewLoadUserArg(g)
	arg.Name = name
	return arg
}

func NewLoadUserPubOptionalArg(g *GlobalContext) LoadUserArg {
	arg := NewLoadUserArg(g)
	arg.PublicKeyOptional = true
	return arg
}

func (arg *LoadUserArg) checkUIDName() error {
	if arg.UID.Exists() {
		return nil
	}

	if len(arg.Name) == 0 && !arg.Self {
		return fmt.Errorf("no username given to LoadUser")
	}

	if len(arg.Name) > 0 && arg.Self {
		return fmt.Errorf("If loading self, can't provide a username")
	}

	if !arg.Self {
		return nil
	}

	if arg.UID = myUID(arg.G(), arg.LoginContext); arg.UID.IsNil() {
		arg.Name = arg.G().Env.GetUsername().String()
		if len(arg.Name) == 0 {
			return SelfNotFoundError{msg: "could not find UID or username for self"}
		}
	}
	return nil
}

func (arg *LoadUserArg) resolveUID() (ResolveResult, error) {
	var rres ResolveResult
	if arg.UID.Exists() {
		return rres, nil
	}
	if len(arg.Name) == 0 {
		// this won't happen anymore because check moved to
		// checkUIDName() func, but just in case
		return rres, fmt.Errorf("resolveUID:  no uid or name")
	}

	if rres = ResolveUID(arg.Name); rres.err != nil {
		return rres, rres.err
	}

	if rres.uid.IsNil() {
		return rres, fmt.Errorf("No resolution for name=%s", arg.Name)
	}

	arg.UID = rres.uid
	return rres, nil
}

// after resolution, check if this is a self load
func (arg *LoadUserArg) checkSelf() {
	if arg.Self {
		return
	}

	myuid := myUID(G, arg.LoginContext)
	if myuid.Exists() && arg.UID.Exists() && myuid.Equal(arg.UID) {
		arg.Self = true
	}
}

func LoadMe(arg LoadUserArg) (*User, error) {
	arg.Self = true
	return LoadUser(arg)
}

func LoadUser(arg LoadUserArg) (ret *User, err error) {
	G.Log.Debug("LoadUser: %+v", arg)
	var refresh bool

	// Whatever the reply is, pass along our desired global context
	defer func() {
		if ret != nil {
			ret.SetGlobalContext(arg.G())
			if refresh {
				arg.G().NotifyRouter.HandleUserChanged(ret.GetUID())
			}
		}
	}()

	// make sure we have a uid or a name to load
	if err = arg.checkUIDName(); err != nil {
		return nil, err
	}

	G.Log.Debug("+ LoadUser(uid=%v, name=%v)", arg.UID, arg.Name)

	// resolve the uid from the name, if necessary
	rres, err := arg.resolveUID()
	if err != nil {
		return nil, err
	}

	// check to see if this is a self load
	arg.checkSelf()

	G.Log.Debug("| resolved to %s", arg.UID)

	// load user from local, remote
	ret, refresh, err = loadUser(arg.G(), arg.UID, rres, arg.ForceReload)
	if err != nil {
		return nil, err
	}

	// Match the returned User object to the Merkle tree. Also make sure
	// that the username queried for matches the User returned (if it
	// was indeed queried for)
	if err = ret.leaf.MatchUser(ret, arg.UID, rres.kbUsername); err != nil {
		return
	}

	if err = ret.LoadSigChains(arg.AllKeys, &ret.leaf, arg.Self); err != nil {
		return
	}

	if ret.sigHints, err = LoadAndRefreshSigHints(ret.id); err != nil {
		return
	}

	if ret.sigHints != nil && ret.sigHints.dirty {
		refresh = true
	}

	// Proactively cache fetches from remote server to local storage
	if e2 := ret.Store(); e2 != nil {
		G.Log.Warning("Problem storing user %s: %s", ret.GetName(), e2)
	}

	if ret.HasActiveKey() {
		if err = ret.MakeIDTable(); err != nil {
			return
		}

		// Check that the user has self-signed only after we
		// consider revocations. See: https://github.com/keybase/go/issues/43
		if err = ret.VerifySelfSig(); err != nil {
			return
		}

	} else if !arg.PublicKeyOptional {

		var emsg string
		if arg.Self {
			emsg = "You don't have a public key; try `keybase pgp select` or `keybase pgp import` if you have a key; or `keybase pgp gen` if you don't"
		}
		err = NoKeyError{emsg}
	}

	return
}

func loadUser(g *GlobalContext, uid keybase1.UID, rres ResolveResult, force bool) (*User, bool, error) {
	local, err := loadUserFromLocalStorage(g, uid)
	var refresh bool
	if err != nil {
		g.Log.Warning("Failed to load %s from storage: %s", uid, err)
	}

	leaf, err := LookupMerkleLeaf(uid, local)
	if err != nil {
		return nil, refresh, err
	}

	var f1, loadRemote bool

	if local == nil {
		g.Log.Debug("| No local user stored for %s", uid)
		loadRemote = true
	} else if f1, err = local.CheckBasicsFreshness(leaf.idVersion); err != nil {
		return nil, refresh, err
	} else {
		loadRemote = !f1
		refresh = loadRemote
	}

	g.Log.Debug("| Freshness: basics=%v; for %s", f1, uid)

	var ret *User
	if !loadRemote && !force {
		ret = local
	} else if ret, err = loadUserFromServer(g, uid, rres.body); err != nil {
		return nil, refresh, err
	}

	if ret == nil {
		return nil, refresh, nil
	}

	ret.leaf = *leaf
	return ret, refresh, nil
}

func loadUserFromLocalStorage(g *GlobalContext, uid keybase1.UID) (u *User, err error) {
	g.Log.Debug("+ loadUserFromLocalStorage(%s)", uid)
	jw, err := g.LocalDb.Get(DbKeyUID(DBUser, uid))
	if err != nil {
		return nil, err
	}

	if jw == nil {
		g.Log.Debug("- loadUserFromLocalStorage(%s): Not found", uid)
		return nil, nil
	}

	g.Log.Debug("| Loaded successfully")

	if u, err = NewUserFromLocalStorage(g, jw); err != nil {
		return nil, err
	}

	if u.id.NotEqual(uid) {
		err = fmt.Errorf("Bad lookup; uid mismatch: %s != %s", uid, u.id)
	}

	g.Log.Debug("| Loaded username %s (uid=%s)", u.name, uid)
	g.Log.Debug("- loadUserFromLocalStorage(%s,%s)", u.name, uid)

	return
}

func loadUserFromServer(g *GlobalContext, uid keybase1.UID, body *jsonw.Wrapper) (u *User, err error) {
	g.Log.Debug("+ Load User from server: %s", uid)

	// Res.body might already have been preloaded a a result of a Resolve call earlier.
	if body == nil {
		res, err := g.API.Get(APIArg{
			Endpoint:    "user/lookup",
			NeedSession: false,
			Args: HTTPArgs{
				"uid": UIDArg(uid),
			},
			Contextified: NewContextified(g),
		})

		if err != nil {
			return nil, err
		}
		body = res.Body.AtKey("them")
	} else {
		g.Log.Debug("| Skipped load; got user object previously")
	}

	if u, err = NewUserFromServer(g, body); err != nil {
		return
	}
	g.Log.Debug("- Load user from server: %s -> %s", uid, ErrToOk(err))

	return
}

func myUID(g *GlobalContext, lctx LoginContext) keybase1.UID {
	if lctx != nil {
		return lctx.LocalSession().GetUID()
	}
	return g.GetMyUID()
}

func LookupMerkleLeaf(uid keybase1.UID, local *User) (f *MerkleUserLeaf, err error) {
	if uid.IsNil() {
		err = fmt.Errorf("uid parameter for LookupMerkleLeaf empty")
		return
	}
	q := NewHTTPArgs()
	q.Add("uid", UIDArg(uid))

	f, err = G.MerkleClient.LookupUser(q)
	if err == nil && f == nil && local != nil {
		err = fmt.Errorf("User not found in server Merkle tree")
	}
	return
}

func LoadUserPlusKeys(g *GlobalContext, uid keybase1.UID, cacheOK bool) (keybase1.UserPlusKeys, error) {
	var up keybase1.UserPlusKeys
	if uid.IsNil() {
		return up, fmt.Errorf("Nil UID")
	}

	if cacheOK {
		up, err := g.UserCache.Get(uid)
		if err == nil {
			return *up, nil
		}
		if err != nil {
			// not going to bail on cache error, just log it:
			if _, ok := err.(NotFoundError); !ok {
				g.Log.Debug("UserCache Get error: %s", err)
			}
		}
	}

	arg := NewLoadUserArg(g)
	arg.UID = uid
	arg.PublicKeyOptional = true
	u, err := LoadUser(arg)
	if err != nil {
		return up, err
	}
	if u == nil {
		return up, fmt.Errorf("Nil user, nil error from LoadUser")
	}

	// export user to UserPlusKeys
	up.Uid = u.GetUID()
	up.Username = u.GetNormalizedName().String()
	if u.GetComputedKeyFamily() != nil {
		up.DeviceKeys = u.GetComputedKeyFamily().ExportDeviceKeys()
	}

	err = g.UserCache.Insert(&up)
	if err != nil {
		g.Log.Debug("UserCache Set error: %s", err)
	}

	return up, nil
}
