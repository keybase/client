package libkb

import (
	"fmt"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type LoadUserArg struct {
	Uid               keybase1.UID
	Name              string
	PublicKeyOptional bool
	NoCacheResult     bool // currently ignore
	Self              bool
	ForceReload       bool
	AllKeys           bool
	LoginContext      LoginContext
	Contextified
}

func LoadMe(arg LoadUserArg) (ret *User, err error) {
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

	if arg.Uid.Exists() {
		// noop
	} else if len(arg.Name) == 0 && !arg.Self {
		err = fmt.Errorf("no username given to LoadUser")
	} else if len(arg.Name) > 0 && arg.Self {
		err = fmt.Errorf("If loading self, can't provide a username")
	} else if !arg.Self {
		// noop
	} else if arg.Uid = myUID(arg.G(), arg.LoginContext); arg.Uid.IsNil() {
		arg.Name = arg.G().Env.GetUsername()
	}

	if err != nil {
		return
	}

	G.Log.Debug("+ LoadUser(uid=%v, name=%v)", arg.Uid, arg.Name)

	var rres ResolveResult
	var uid keybase1.UID
	if arg.Uid.Exists() {
		uid = arg.Uid
	} else if len(arg.Name) == 0 {
		err = LoadUserError{"we don't know the current user's UID or name"}
		return
	} else if rres = ResolveUid(arg.Name); rres.err != nil {
		err = rres.err
		return
	} else if rres.uid.IsNil() {
		err = fmt.Errorf("No resolution for name=%s", arg.Name)
		return
	} else {
		arg.Uid = rres.uid
		uid = arg.Uid
	}

	if !arg.Self {
		if myuid := myUID(G, arg.LoginContext); myuid.Exists() && arg.Uid.Exists() && myuid.Equal(arg.Uid) {
			arg.Self = true
		}
	}

	G.Log.Debug("| resolved to %s", uid)

	var local, remote *User

	if local, err = LoadUserFromLocalStorage(uid); err != nil {
		G.Log.Warning("Failed to load %s from storage: %s", uid, err.Error())
	}

	leaf, err := LookupMerkleLeaf(uid, local)
	if err != nil {
		return
	}

	var f1, load_remote bool

	if local == nil {
		G.Log.Debug("| No local user stored for %s", uid)
		load_remote = true
	} else if f1, err = local.CheckBasicsFreshness(leaf.idVersion); err != nil {
		return
	} else {
		load_remote = !f1
	}

	G.Log.Debug("| Freshness: basics=%v; for %s", f1, uid)

	if !load_remote && !arg.ForceReload {
		ret = local
	} else if remote, err = LoadUserFromServer(arg, rres.body); err != nil {
		return
	} else {
		ret = remote
	}

	if ret == nil {
		return
	}

	ret.leaf = *leaf

	// If the user was looked-up via a keybase username, then
	// we should go ahead and check that the username matches the UID
	if len(rres.kbUsername) > 0 {
		if err = leaf.MatchUser(ret, arg.Uid, rres.kbUsername); err != nil {
			return
		}
	}

	if err = ret.LoadSigChains(arg.AllKeys, leaf, arg.Self); err != nil {
		return
	}

	if ret.sigHints, err = LoadAndRefreshSigHints(ret.id); err != nil {
		return
	}

	// Proactively cache fetches from remote server to local storage
	if e2 := ret.Store(); e2 != nil {
		G.Log.Warning("Problem storing user %s: %s", ret.GetName(), e2.Error())
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

func LoadUserFromLocalStorage(uid keybase1.UID) (u *User, err error) {
	G.Log.Debug("+ LoadUserFromLocalStorage(%s)", uid)
	jw, err := G.LocalDb.Get(DbKeyUID(DB_USER, uid))
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

func LoadUserFromServer(arg LoadUserArg, body *jsonw.Wrapper) (u *User, err error) {
	G.Log.Debug("+ Load User from server: %s", arg.Uid)

	// Res.body might already have been preloaded a a result of a Resolve call earlier.
	if body == nil {
		res, err := G.API.Get(ApiArg{
			Endpoint:    "user/lookup",
			NeedSession: false,
			Args: HttpArgs{
				"uid": UIDArg(arg.Uid),
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
	G.Log.Debug("- Load user from server: %s -> %s", arg.Uid, ErrToOk(err))

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
	q := NewHttpArgs()
	q.Add("uid", UIDArg(uid))

	f, err = G.MerkleClient.LookupUser(q)
	if err == nil && f == nil && local != nil {
		err = fmt.Errorf("User not found in server Merkle tree")
	}
	return
}
