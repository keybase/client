package libkb

import (
	"fmt"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type LoadUserArg struct {
	UID               keybase1.UID
	Name              string
	PublicKeyOptional bool
	NoCacheResult     bool // currently ignore
	Self              bool
	ForceReload       bool
	AllKeys           bool
	LoginContext      LoginContext
	Contextified
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
	}
	return nil
}

func (arg *LoadUserArg) resolveUID() (ResolveResult, error) {
	var rres ResolveResult
	if arg.UID.Exists() {
		return rres, nil
	}
	if len(arg.Name) == 0 {
		return rres, LoadUserError{"we don't know the current user's UID or name"}
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

	// Whatever the reply is, pass along our desired global context
	defer func() {
		if ret != nil {
			ret.SetGlobalContext(arg.G())
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
	ret, err = loadUser(arg.UID, rres, arg.ForceReload)
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
			emsg = "You don't have a public key; try `keybase push` if you have a key; or `keybase gen` if you don't"
		}
		err = NoKeyError{emsg}
	}

	return
}

func loadUser(uid keybase1.UID, rres ResolveResult, force bool) (*User, error) {
	local, err := LoadUserFromLocalStorage(uid)
	if err != nil {
		G.Log.Warning("Failed to load %s from storage: %s", uid, err)
	}

	leaf, err := LookupMerkleLeaf(uid, local)
	if err != nil {
		return nil, err
	}

	var f1, loadRemote bool

	if local == nil {
		G.Log.Debug("| No local user stored for %s", uid)
		loadRemote = true
	} else if f1, err = local.CheckBasicsFreshness(leaf.idVersion); err != nil {
		return nil, err
	} else {
		loadRemote = !f1
	}

	G.Log.Debug("| Freshness: basics=%v; for %s", f1, uid)

	var ret *User
	if !loadRemote && !force {
		ret = local
	} else if ret, err = LoadUserFromServer(uid, rres.body); err != nil {
		return nil, err
	}

	if ret == nil {
		return nil, nil
	}

	ret.leaf = *leaf
	return ret, nil
}

func LoadUserFromLocalStorage(uid keybase1.UID) (u *User, err error) {
	G.Log.Debug("+ LoadUserFromLocalStorage(%s)", uid)
	jw, err := G.LocalDb.Get(DbKeyUID(DBUser, uid))
	if err != nil {
		return nil, err
	}

	if jw == nil {
		G.Log.Debug("- LoadUserFromLocalStorage(%s): Not found", uid)
		return nil, nil
	}

	G.Log.Debug("| Loaded successfully")

	if u, err = NewUserFromLocalStorage(jw); err != nil {
		return nil, err
	}

	if u.id.NotEqual(uid) {
		err = fmt.Errorf("Bad lookup; uid mismatch: %s != %s", uid, u.id)
	}

	G.Log.Debug("| Loaded username %s (uid=%s)", u.name, uid)
	G.Log.Debug("- LoadUserFromLocalStorage(%s,%s)", u.name, uid)

	return
}

func LoadUserFromServer(uid keybase1.UID, body *jsonw.Wrapper) (u *User, err error) {
	G.Log.Debug("+ Load User from server: %s", uid)

	// Res.body might already have been preloaded a a result of a Resolve call earlier.
	if body == nil {
		res, err := G.API.Get(APIArg{
			Endpoint:    "user/lookup",
			NeedSession: false,
			Args: HTTPArgs{
				"uid": UIDArg(uid),
			},
		})

		if err != nil {
			return nil, err
		}
		body = res.Body.AtKey("them")
	} else {
		G.Log.Debug("| Skipped load; got user object previously")
	}

	if u, err = NewUserFromServer(body); err != nil {
		return
	}
	G.Log.Debug("- Load user from server: %s -> %s", uid, ErrToOk(err))

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
