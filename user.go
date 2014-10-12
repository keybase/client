package libkb

import (
	"code.google.com/p/go.crypto/openpgp"
	"fmt"
	"github.com/hashicorp/golang-lru"
	"github.com/keybase/go-jsonw"
	"strings"
)

type UID string

type CachedVerification struct {
	flag      bool
	publicKey *PgpFingerprint
	lastLink  LinkId
	seqno     int
}

type User struct {
	// Raw JSON element read from the server or our local DB.
	basics      *jsonw.Wrapper
	publicKeys  *jsonw.Wrapper
	sigs        *jsonw.Wrapper
	privateKeys *jsonw.Wrapper

	// Processed fields
	id       UID
	name     string
	sigChain *SigChain
	idTable  *IdentityTable

	loggedIn bool // if we were logged in when we loaded it

	verified             CachedVerification
	activeKey            *PgpKeyBundle
	activePgpFingerprint *PgpFingerprint

	dirty bool
}

//==================================================================
// Thin wrapper around hashicorp's LRU to store users locally

type LoadUserArg struct {
	name             string
	requirePublicKey bool
	noCacheResult    bool
	self             bool
	loadSecrets      bool
	forceReload      bool
	skipVerify       bool
}

type ResolveResult struct {
	res string
	err error
}

type UserCache struct {
	lru          *lru.Cache
	resolveCache map[string]ResolveResult
	uidMap       map[string]UID
}

func NewUserCache(c int) (ret *UserCache, err error) {
	G.Log.Debug("Making new UserCache; size=%d", c)
	tmp, err := lru.New(c)
	if err == nil {
		ret = &UserCache{
			tmp,
			make(map[string]ResolveResult),
			make(map[string]UID),
		}
	}
	return ret, err
}

func (c *UserCache) Put(u *User) {
	c.lru.Add(u.id, u)
	c.uidMap[u.GetName()] = u.GetUID()
}

func (c *UserCache) Get(id UID) *User {
	tmp, ok := c.lru.Get(id)
	var ret *User
	if ok {
		ret, ok = tmp.(*User)
		if !ok {
			G.Log.Error("Unexpected type assertion failure in UserCache")
			ret = nil
		}
	}
	return ret
}

func (c *UserCache) GetByName(s string) *User {
	if uid, ok := c.uidMap[s]; !ok {
		return nil
	} else {
		return c.Get(uid)
	}
}

func (c *UserCache) CacheServerGetVector(vec *jsonw.Wrapper) error {
	l, err := vec.Len()
	if err != nil {
		return err
	}
	for i := 0; i < l; i++ {
		obj := vec.AtIndex(i)
		if !obj.IsNil() {
			if u, err := NewUser(obj); err != nil {
				c.Put(u)
			}
		}
	}
	return nil
}

//==================================================================

func NewUser(o *jsonw.Wrapper) (*User, error) {

	id, err := o.AtKey("id").GetString()
	if err != nil {
		return nil, fmt.Errorf("user object lacks an ID")
	}
	name, err := o.AtKey("basics").AtKey("username").GetString()
	if err != nil {
		return nil, fmt.Errorf("user object for %s lacks a name", id)
	}

	return &User{
		basics:      o.AtKey("basics"),
		publicKeys:  o.AtKey("public_keys"),
		sigs:        o.AtKey("sigs"),
		privateKeys: o.AtKey("private_keys"),
		id:          UID(id),
		name:        name,
		loggedIn:    false,
		verified:    CachedVerification{false, nil, nil, 0},
		dirty:       false,
	}, nil
}

func (u User) GetName() string { return u.name }
func (u User) GetUID() UID     { return u.id }

func NewUserFromServer(o *jsonw.Wrapper) (*User, error) {
	u, e := NewUser(o)
	if e != nil {
		u.loggedIn = G.LoginState.LoggedIn
		u.dirty = true
	}
	return u, e
}

func (u User) GetSeqno() int {
	ret := -1
	var err error
	u.sigs.AtKey("last").AtKey("seqno").GetIntVoid(&ret, &err)
	return ret
}

func NewUserFromLocalStorage(o *jsonw.Wrapper) (*User, error) {
	u, err := NewUser(o)
	if err == nil {
		verified := o.AtKey("verified")
		vsn, e1 := verified.AtKey("seqno").GetInt()
		vpk, e2 := verified.AtKey("public_key").GetString()
		vcl, e3 := verified.AtKey("last_link").GetString()
		if e1 == nil && e2 == nil && e3 == nil {
			if fp, e4 := PgpFingerprintFromHex(vpk); e4 == nil {
				if cl, e5 := LinkIdFromHex(vcl); e5 == nil {
					u.verified.flag = true
					u.verified.publicKey = fp
					u.verified.lastLink = cl
					u.verified.seqno = vsn
				}
			}
		}
	}
	return u, err
}

func (u *User) LoadSigChainFromServer(base *SigChain) error {
	if err := u.MakeSigChain(base); err != nil {
		return nil
	}
	return u.sigChain.LoadFromServer()
}

func (u *User) MakeSigChain(base *SigChain) error {
	if f, err := u.GetActivePgpFingerprint(); err != nil {
		return err
	} else if u.sigs != nil && f != nil {
		last := u.sigs.AtKey("last")
		var seqno int
		var lid LinkId
		last.AtKey("seqno").GetIntVoid(&seqno, &err)
		GetLinkIdVoid(last.AtKey("payload_hash"), &lid, &err)
		if err != nil {
			return fmt.Errorf("Badly formatted sigchain tail for user %s: %s",
				u.name, err.Error())
		} else {
			u.sigChain = NewSigChain(u.id, seqno, lid, f, base)
		}
	} else if base != nil {
		return fmt.Errorf("Signature chain corruption for %s; unexpected base",
			u.name)
	} else {
		G.Log.Debug("Empty sigchain for %s", u.name)
		u.sigChain = NewEmptySigChain(u.id)
	}
	return nil
}

func (u *User) LoadSigChainFromStorage() error {
	if err := u.MakeSigChain(nil); err != nil {
		return err
	}
	return u.sigChain.LoadFromStorage()
}

func LoadUserFromLocalStorage(name string) (u *User, err error) {

	jw, err := G.LocalDb.Lookup(DbKey{Typ: DB_LOOKUP_USERNAME, Key: name})
	if err != nil {
		return nil, err
	}

	if u == nil {
		return nil, nil
	}

	if u, err = NewUserFromLocalStorage(jw); err != nil {
		return nil, err
	}

	if err = u.LoadSigChainFromStorage(); err != nil {
		return nil, err
	}

	return nil, nil
}

func (u *User) GetActivePgpFingerprint() (f *PgpFingerprint, err error) {
	if u.activePgpFingerprint != nil {
		return u.activePgpFingerprint, nil
	}

	w := u.publicKeys.AtKey("primary").AtKey("fingerprint")
	if w.IsNil() {
		return nil, nil
	}
	fp, err := GetPgpFingerprint(w)
	if err != nil {
		return nil, err
	}
	u.activePgpFingerprint = fp
	return fp, err
}

func (u *User) GetActiveKey() (pgp *PgpKeyBundle, err error) {
	if u.activeKey != nil {
		return u.activeKey, nil
	}

	w := u.publicKeys.AtKey("primary").AtKey("bundle")
	if w.IsNil() {
		return nil, nil
	}

	k, err := w.GetString()
	if err != nil {
		return nil, err
	}

	reader := strings.NewReader(k)
	el, err := openpgp.ReadKeyRing(reader)
	if err != nil {
		return nil, err
	}
	if len(el) == 0 {
		return nil, fmt.Errorf("No keys found in primary bundle")
	}
	u.activeKey = (*PgpKeyBundle)(el[0])

	return u.activeKey, nil
}

func LoadUserFromServer(arg LoadUserArg) (u *User, err error) {
	G.Log.Debug("+ Load User from server: %s", arg.name)

	res, err := G.API.Get(ApiArg{
		Endpoint:    "user/lookup",
		NeedSession: (arg.loadSecrets && arg.self),
		Args: HttpArgs{
			"username": S{arg.name},
		},
	})

	if err != nil {
		return
	}

	u, err = NewUserFromServer(res.Body.AtKey("them"))

	G.Log.Debug("- Load user from server: %s -> %b", arg.name, (err == nil))

	return
}

func (remote *User) Update(local *User) (ret *User, err error) {
	a := -1
	var base *SigChain
	if local != nil {
		a = local.GetSeqno()
		base = local.sigChain
	}
	b := remote.GetSeqno()
	if b < 0 || a > b {
		err = fmt.Errorf("Server version-rollback sustpected: Local %d > %d",
			a, b)
	} else if b == a {
		ret = local
	} else {
		if err = remote.LoadSigChainFromServer(base); err == nil {
			ret = remote
		}
	}
	return
}

func (u *User) VerifySigChain() error {
	var err error
	G.Log.Debug("+ VerifySigChain for %s", u.name)
	key, err := u.GetActiveKey()
	if err != nil {
		return err
	}
	ch := u.sigChain
	if ch == nil {
		return fmt.Errorf("Internal error: sigchain shouldn't be null")
	}

	cached, err := ch.VerifyWithKey(key, &u.verified)
	if !cached {
		u.dirty = true
	}

	G.Log.Debug("- VerifySigChain for %s -> %b", u.name, (err == nil))
	return err
}

func (u *User) StoreSigChain() error {
	var err error
	if u.sigChain != nil {
		err = u.sigChain.Store()
	}
	return err
}

func (u *User) Store() error {

	G.Log.Debug("+ Store user %s", u.name)

	// We'll refuse to store anything that doesn't verify (since we don't
	// want the spoiled data in our cace).
	//
	// Potentially revisit this decision later.
	if err := u.VerifySigChain(); err != nil {
		return err
	}

	if !u.dirty {
		G.Log.Debug("- Store for %u skipped; user wasn't dirty", u.name)
		return nil
	}

	if err := u.StoreSigChain(); err != nil {
		return err
	}

	if err := u.StoreTopLevel(); err != nil {
		return err
	}

	u.dirty = false
	G.Log.Debug("- Store user %s -> OK", u.name)

	return nil
}

func (u *User) StoreTopLevel() error {

	jw := jsonw.NewDictionary()
	jw.SetKey("basics", u.basics)
	jw.SetKey("public_keys", u.publicKeys)
	jw.SetKey("sigs", u.sigs)
	jw.SetKey("privateKeys", u.privateKeys)
	if v := u.sigChain.PackVerification(); v != nil {
		jw.SetKey("verified", v)
	}

	err := G.LocalDb.Put(
		DbKey{Typ: DB_USER, Key: string(u.id)},
		[]DbKey{{Typ: DB_LOOKUP_USERNAME, Key: u.name}},
		jw,
	)

	return err
}

func LoadUser(arg LoadUserArg) (ret *User, err error) {

	var name string

	name, err = ResolveUsername(arg.name)
	if err != nil {
		return
	}

	if !arg.forceReload {
		if u := G.UserCache.GetByName(name); u != nil {
			return u, nil
		}
	}

	local, err := LoadUserFromLocalStorage(name)
	if err != nil {
		return
	}

	remote, err := LoadUserFromServer(arg)
	if err != nil {
		return
	}

	ret, err = remote.Update(local)
	if err != nil {
		return
	}

	if !arg.skipVerify {
		if err = ret.VerifySigChain(); err != nil {
			return
		}

		// Proactive cache fetches from remote server to local
		if e2 := ret.Store(); e2 != nil {
			G.Log.Warning("Problem storing user %s: %s",
				name, e2.Error())
		}
	}

	if !arg.noCacheResult && ret != nil {
		G.UserCache.Put(ret)
	}

	return
}

//==================================================================
