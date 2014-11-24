package libkb

import (
	"encoding/hex"
	"fmt"
	"github.com/hashicorp/golang-lru"
	"github.com/keybase/go-jsonw"
)

const (
	UID_LEN    = 16
	UID_SUFFIX = 0x00
)

type UID [UID_LEN]byte

func (u UID) ToString() string {
	return hex.EncodeToString(u[:])
}

func UidFromHex(s string) (u *UID, err error) {
	var bv []byte
	bv, err = hex.DecodeString(s)
	if err != nil {
		return
	}
	if len(bv) != UID_LEN {
		err = fmt.Errorf("Bad UID '%s'; must be %d bytes long", UID_LEN)
		return
	}
	if bv[len(bv)-1] != UID_SUFFIX {
		err = fmt.Errorf("Bad UID '%s': must end in 0x'%x'", UID_SUFFIX)
		return
	}
	out := UID{}
	copy(out[:], bv[0:UID_LEN])
	u = &out
	return
}

func GetUid(w *jsonw.Wrapper) (u *UID, err error) {
	s, err := w.GetString()
	if err != nil {
		return nil, err
	}
	ret, err := UidFromHex(s)
	return ret, err
}

func (u UID) Eq(u2 UID) bool {
	return FastByteArrayEq(u[:], u2[:])
}

func GetUidVoid(w *jsonw.Wrapper, u *UID, e *error) {
	ret, err := GetUid(w)
	if err != nil {
		*e = err
	} else {
		*u = *ret
	}
	return
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
	IdTable  *IdentityTable
	sigHints *SigHints

	loggedIn bool // if we were logged in when we loaded it
	secret   bool // if we asked for secret keys when we loaded

	activeKey            *PgpKeyBundle
	activePgpFingerprint *PgpFingerprint

	// If we've previously identified this user, the result
	// can be cached here.
	cachedIdentifyRes *IdentifyRes

	dirty bool
}

//==================================================================
// Thin wrapper around hashicorp's LRU to store users locally

type LoadUserArg struct {
	Uid               *UID
	Name              string
	PublicKeyOptional bool
	NoCacheResult     bool
	Self              bool
	LoadSecrets       bool
	ForceReload       bool
	AllKeys           bool
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
	c.uidMap[u.GetName()] = u.GetUid()
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
	uid, err := GetUid(o.AtKey("id"))
	if err != nil {
		return nil, fmt.Errorf("user object lacks an ID: %s", err.Error())
	}
	name, err := o.AtKey("basics").AtKey("username").GetString()
	if err != nil {
		return nil, fmt.Errorf("user object for %s lacks a name", uid.ToString())
	}

	return &User{
		basics:      o.AtKey("basics"),
		publicKeys:  o.AtKey("public_keys"),
		sigs:        o.AtKey("sigs"),
		privateKeys: o.AtKey("private_keys"),
		id:          *uid,
		name:        name,
		loggedIn:    false,
		dirty:       false,
		secret:      false,
	}, nil
}

func (u User) GetName() string { return u.name }
func (u User) GetUid() UID     { return u.id }

func (u User) GetIdVersion() (int64, error) {
	return u.basics.AtKey("id_version").GetInt64()
}

func NewUserFromServer(o *jsonw.Wrapper) (*User, error) {
	u, e := NewUser(o)
	if e == nil {
		u.loggedIn = G.Session.IsLoggedIn()
		u.dirty = true
	}
	return u, e
}

func (u User) GetSeqno() Seqno {
	var ret int64 = -1
	var err error
	u.sigs.AtKey("last").AtKey("seqno").GetInt64Void(&ret, &err)
	return Seqno(ret)
}

func NewUserFromLocalStorage(o *jsonw.Wrapper) (*User, error) {
	u, err := NewUser(o)
	return u, err
}

func (u *User) LoadSigChainFromServer(base *SigChain, t *MerkleTriple) error {
	G.Log.Debug("+ LoadSigChainFromServer(%s)", u.name)
	if err := u.MakeSigChain(base); err != nil {
		return nil
	}
	err := u.sigChain.LoadFromServer(t)
	G.Log.Debug("- LoadSigChainFromServer(%s) -> %v", u.name, (err == nil))

	return err
}

func (u *User) MakeSigChain(base *SigChain) error {
	if f, err := u.GetActivePgpFingerprint(); err != nil {
		return err
	} else if u.sigs != nil && !u.sigs.IsNil() {
		last := u.sigs.AtKey("last")
		var seqno int
		var lid LinkId
		last.AtKey("seqno").GetIntVoid(&seqno, &err)
		GetLinkIdVoid(last.AtKey("payload_hash"), &lid, &err)
		if err != nil {
			return fmt.Errorf("Badly formatted sigchain tail for user %s: %s",
				u.name, err.Error())
		} else {
			u.sigChain = NewSigChain(u.id, u.name, seqno, lid, f, base)
		}
	} else if base != nil {
		return fmt.Errorf("Signature chain corruption for %s; unexpected base",
			u.name)
	} else {
		G.Log.Debug("| Empty sigchain for %s", u.name)
		u.sigChain = NewEmptySigChain(u.id, u.name)
	}
	return nil
}

func (u *User) LoadSigChainFromStorage(allKeys bool) error {
	G.Log.Debug("+ LoadSigChainFromStorage(%s)", u.name)
	if err := u.MakeSigChain(nil); err != nil {
		return err
	}
	err := u.sigChain.LoadFromStorage(allKeys)
	G.Log.Debug("- LoadSigChainFromStorage(%s) -> %v", u.name, (err == nil))
	return err
}

func LoadUserFromLocalStorage(uid UID, allKeys bool, loadSecrets bool) (u *User, err error) {

	uid_s := uid.ToString()
	G.Log.Debug("+ LoadUserFromLocalStorage(%s)", uid_s)

	jw, err := G.LocalDb.Get(DbKey{Typ: DB_USER, Key: uid_s})
	if err != nil {
		return nil, err
	}

	if jw == nil {
		G.Log.Debug("- LoadUserFromLocalStorage(%s): Not found", uid_s)
		return nil, nil
	}

	G.Log.Debug("| Loaded successfully")

	if !loadSecrets {
		// noop
	} else if sk, err := G.LocalDb.Get(DbKey{Typ: DB_USER_SECRET_KEYS, Key: uid_s}); err != nil {
		return nil, err
	} else if sk != nil {
		G.Log.Debug("| Found secret keys for user %s", uid_s)
		jw.SetKey("private_keys", sk)
	} else {
		G.Log.Debug("| Didn't find secret keys for user %s", uid_s)
	}

	if u, err = NewUserFromLocalStorage(jw); err != nil {
		return nil, err
	}

	if !u.id.Eq(uid) {
		err = fmt.Errorf("Bad lookup; uid mismatch: %s != %s",
			uid_s, u.id.ToString())
	}

	G.Log.Debug("| Loaded username %s (uid=%s)", u.name, uid_s)

	if err = u.LoadSigChainFromStorage(allKeys); err != nil {
		return nil, err
	}

	G.Log.Debug("- LoadUserFromLocalStorage(%s,%s)", u.name, uid_s)

	return
}

func (u *User) GetActivePgpFingerprint() (f *PgpFingerprint, err error) {

	if u.activePgpFingerprint != nil {
		return u.activePgpFingerprint, nil
	}

	w := u.publicKeys.AtKey("primary").AtKey("key_fingerprint")

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

func (u *User) SetActiveKey(pgp *PgpKeyBundle) (err error) {
	u.activeKey = nil
	u.activePgpFingerprint = nil

	if u.publicKeys == nil || u.publicKeys.IsNil() {
		u.publicKeys = jsonw.NewDictionary()
	}
	var d *jsonw.Wrapper
	if pgp != nil {
		if s, err := pgp.Encode(); err != nil {
			return err
		} else {
			d = jsonw.NewDictionary()
			d.SetKey("bundle", jsonw.NewString(s))
			d.SetKey("key_fingerprint", jsonw.NewString(pgp.GetFingerprint().ToString()))
		}
	} else {
		d = jsonw.NewNil()
	}

	if err = u.publicKeys.SetKey("primary", d); err != nil {
		return err
	}

	u.dirty = true
	return nil
}

func (u *User) GetActiveKey() (pgp *PgpKeyBundle, err error) {

	G.Log.Debug("+ GetActiveKey() for %s", u.name)
	if u.activeKey != nil {
		G.Log.Debug("- GetActiveKey() -> %s",
			u.activeKey.GetFingerprint().ToString())
		return u.activeKey, nil
	}

	w := u.publicKeys.AtKey("primary").AtKey("bundle")
	if w.IsNil() {
		return nil, nil
	}

	key, err := GetOneKey(w)

	if err != nil {
		return nil, err
	}

	u.activeKey = key
	G.Log.Debug("| Active key is -> %s", u.activeKey.GetFingerprint().ToString())
	G.Log.Debug("- GetActiveKey() for %s", u.name)

	return u.activeKey, nil
}

func LoadUserFromServer(arg LoadUserArg, body *jsonw.Wrapper) (u *User, err error) {

	uid_s := arg.Uid.ToString()
	G.Log.Debug("+ Load User from server: %s (secrets=%v)", uid_s, arg.LoadSecrets)

	// Res.body might already have been preloaded a a result of a Resolve call earlier.
	if body == nil {
		res, err := G.API.Get(ApiArg{
			Endpoint:    "user/lookup",
			NeedSession: (arg.LoadSecrets && arg.Self),
			Args: HttpArgs{
				"uid": S{uid_s},
			},
		})

		if err != nil {
			return nil, err
		} else {
			body = res.Body.AtKey("them")
		}
	} else {
		G.Log.Debug("| Skipped load; got user object previously")
	}

	if u, err = NewUserFromServer(body); err != nil {
		return
	}

	G.Log.Debug("- Load user from server: %s -> %s", uid_s, ErrToOk(err))

	return
}

func (u *User) GetServerSeqno() (i int, err error) {
	i = -1

	G.Log.Debug("+ Get server seqno for user: %s", u.name)
	res, err := G.API.Get(ApiArg{
		Endpoint:    "user/lookup",
		NeedSession: false,
		Args: HttpArgs{
			"username": S{u.name},
			"fields":   S{"sigs"},
		},
	})
	if err != nil {
		return
	}
	i, err = res.Body.AtKey("them").AtKey("sigs").AtKey("last").AtKey("seqno").GetInt()
	if err != nil {
		return
	}
	G.Log.Debug("- Server seqno: %s -> %d", u.name, i)
	return i, err
}

func (local *User) CheckBasicsFreshness(server int64) (current bool, err error) {
	var stored int64
	if stored, err = local.GetIdVersion(); err == nil {
		current = (stored >= server)
		if current {
			G.Log.Debug("| Local basics version is up-to-date @ version %d", stored)
		} else {
			G.Log.Debug("| Local basics version is out-of-date: %d < %d", stored, server)
		}
	}
	return
}

func (local *User) CheckChainFreshness(t *MerkleTriple) (current bool, err error) {
	current = false

	a := local.GetSeqno()

	if t == nil {
		if a > 0 {
			err = fmt.Errorf("Server claimed not to have this user in its tree (we had v=%d)", a)
		}
	} else if b := t.seqno; b < 0 || a > b {
		err = fmt.Errorf("Server version-rollback sustpected: Local %d > %d",
			a, b)
	} else if b == a {
		G.Log.Debug("| Local chain version is up-to-date @ version %d", b)
		current = true
		last := local.sigChain.GetLastLinkRecursive()
		if last == nil {
			err = fmt.Errorf("Failed to read last link for user")
		} else if !last.id.Eq(t.linkId) {
			err = fmt.Errorf("The server returned the wrong sigchain tail")
		}
	} else {
		G.Log.Debug("| Local chain version is out-of-date: %d < %d", a, b)
		current = false
	}
	G.Log.Debug("+ CheckSeqno(%s) -> %v", local.name, current)
	return
}

func (u *User) BorrowSigChainFrom(u2 *User) {
	G.Log.Debug("| Borrowing SigChain from locally stored user")
	u.sigChain = u2.sigChain
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

	cached, err := ch.VerifyWithKey(key)
	if !cached {
		u.dirty = true
	}

	G.Log.Debug("- VerifySigChain for %s -> %v", u.name, (err == nil))
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

	// These might be dirty, in which case we can write it back
	// to local storage. Note, this can be dirty even if the user is clean.
	if err := u.sigHints.Store(); err != nil {
		return err
	}

	if !u.dirty {
		G.Log.Debug("- Store for %s skipped; user wasn't dirty", u.name)
		return nil
	}

	if err := u.StoreSigChain(); err != nil {
		return err
	}

	if err := u.StoreTopLevel(); err != nil {
		return err
	}

	if err := u.StoreSecretKeys(); err != nil {
		return err
	}

	u.dirty = false
	G.Log.Debug("- Store user %s -> OK", u.name)

	return nil
}

func (u *User) StoreTopLevel() error {

	uid_s := u.id.ToString()
	jw := jsonw.NewDictionary()
	jw.SetKey("id", jsonw.NewString(uid_s))
	jw.SetKey("basics", u.basics)
	jw.SetKey("public_keys", u.publicKeys)
	jw.SetKey("sigs", u.sigs)

	err := G.LocalDb.Put(
		DbKey{Typ: DB_USER, Key: uid_s},
		[]DbKey{{Typ: DB_LOOKUP_USERNAME, Key: u.name}},
		jw,
	)
	if err != nil {
		return err
	}

	return err
}

func getSecretKey(jw *jsonw.Wrapper, fp PgpFingerprint) (ret *P3SKB, err error) {
	var packet *KeybasePacket
	var pub *PgpKeyBundle

	if packet, err = GetPacket(jw.AtKey("bundle")); err != nil {
		fmt.Printf("GET PACKET Failure")
	} else if ret, err = packet.ToP3SKB(); err != nil {
	} else if pub, err = ret.GetPubKey(); err != nil {
	} else if fp2 := pub.GetFingerprint(); !fp2.Eq(fp) {
		ret = nil
		err = WrongKeyError{&fp, &fp2}
	}
	return
}

func (u *User) GetSecretKey(fp PgpFingerprint) (ret *P3SKB, err error) {
	G.Log.Debug("+ User.GetSecretKey(%s)", fp.ToString())
	defer func() {
		G.Log.Debug("- User.GetSecretKey() -> %s", ErrToOk(err))
	}()
	if u.privateKeys == nil || u.privateKeys.IsNil() {
		G.Log.Debug("| short-circuit; no privateKeys object found")
		return
	}
	ret, err = getSecretKey(u.privateKeys.AtKey("primary"), fp)
	return
}

func (u *User) StoreSecretKeys() error {
	var err error
	G.Log.Debug("+ StoreSecretKey()")
	if u.privateKeys != nil && !u.privateKeys.IsNil() {
		G.Log.Debug("| doing put")
		err = G.LocalDb.Put(
			DbKey{Typ: DB_USER_SECRET_KEYS, Key: u.id.ToString()},
			nil,
			u.privateKeys,
		)
	}
	G.Log.Debug("- StoreSecretKey() -> %s", ErrToOk(err))
	return err
}

func LookupMerkleLeaf(uid UID, local *User) (f *MerkleUserLeaf, err error) {
	q := NewHttpArgs()
	q.Add("uid", S{uid.ToString()})

	f, err = G.MerkleClient.LookupUser(q)
	if err == nil && f == nil && local != nil {
		err = fmt.Errorf("User not found in server Merkle tree")
	}
	return
}

func (u *User) MakeIdTable(allKeys bool) error {
	u.sigChain.FlattenAndPrune(allKeys)
	u.IdTable = NewIdentityTable(u.sigChain, u.sigHints)
	return nil
}

func LoadMe(arg LoadUserArg) (ret *User, err error) {
	arg.Self = true
	return LoadUser(arg)
}

func (u *User) VerifySelfSig() error {

	G.Log.Debug("+ VerifySelfSig for user %s", u.name)

	if u.IdTable.VerifySelfSig(u.name, u.id) {
		G.Log.Debug("- VerifySelfSig via SigChain")
		return nil
	}

	if u.VerifySelfSigByKey() {
		G.Log.Debug("- VerifySelfSig via Key")
		return nil
	}

	G.Log.Debug("- VerifySelfSig failed")
	return fmt.Errorf("Failed to find a self-signature for %s", u.name)
}

func (u *User) VerifySelfSigByKey() bool {

	name := u.GetName()
	if key, err := u.GetActiveKey(); err == nil && key != nil {
		for _, ident := range key.Identities {
			if i, e2 := ParseIdentity(ident.Name); e2 == nil {
				if i.Email == KeybaseEmailAddress(name) {
					G.Log.Debug("| Found self-sig for %s in key ID: %s",
						name, ident.Name)
					return true
				}
			}
		}
	}
	return false
}

func LoadUser(arg LoadUserArg) (ret *User, err error) {

	var name string

	if arg.Uid != nil {
		// noop
	} else if len(arg.Name) == 0 && !arg.Self {
		err = fmt.Errorf("no username given to LoadUser")
	} else if len(arg.Name) > 0 && arg.Self {
		err = fmt.Errorf("If loading self, can't provide a username")
	} else if !arg.Self {
		// noop
	} else if arg.Uid = G.GetMyUid(); arg.Uid == nil {
		arg.Name = G.Env.GetUsername()
	}

	if err != nil {
		return
	}

	G.Log.Debug("+ LoadUser(uid=%v, name=%v)", arg.Uid, arg.Name)

	var rres ResolveResult
	var uid UID
	if arg.Uid != nil {
		uid = *arg.Uid
	} else if rres = ResolveUid(arg.Name); rres.err != nil {
		err = rres.err
		return
	} else if rres.uid == nil {
		err = fmt.Errorf("No resolution for name=%s", arg.Name)
		return
	} else {
		uid = *rres.uid
		arg.Uid = &uid
	}

	if my_uid := G.GetMyUid(); my_uid != nil && arg.Uid != nil &&
		my_uid.Eq(*arg.Uid) && !arg.Self {
		arg.Self = true
	}

	uid_s := uid.ToString()
	G.Log.Debug("| resolved to %s", uid_s)

	var local, remote *User

	if !arg.ForceReload {

		//
		// XXX - this isn't exactly right. We should maybe still poll the
		// server for updates....
		//
		// Also, let's only allow a cached version if it has secrets
		// or if the load wasn't for a user with secrets.
		//
		if u := G.UserCache.Get(uid); u != nil && (u.secret || !arg.LoadSecrets) {
			G.Log.Debug("| Found user in user cache: %s")
			return u, nil
		}

		local, err = LoadUserFromLocalStorage(uid, arg.AllKeys, arg.LoadSecrets)
		if err != nil {
			G.Log.Warning("Failed to load %s from storage: %s",
				uid_s, err.Error())
		}
	}

	leaf, err := LookupMerkleLeaf(uid, local)
	if err != nil {
		return
	}

	var baseChain *SigChain
	var f1, f2, load_remote, load_chain bool

	if local == nil {
		G.Log.Debug("| No local user stored for %s", uid_s)
		load_remote = true
		load_chain = true
	} else if f1, err = local.CheckBasicsFreshness(leaf.idVersion); err != nil {
		// noop
	} else if f2, err = local.CheckChainFreshness(leaf.public); err != nil {
		// noop
	} else {
		load_remote = !f1
		load_chain = !f2
		baseChain = local.sigChain
	}

	// If there was a problem in checking freshness, time to bail out
	if err != nil {
		return
	}

	G.Log.Debug("| Freshness: chain=%v; basics=%v; for %s",
		!load_chain, !load_remote, uid_s)

	if load_remote {
		if remote, err = LoadUserFromServer(arg, rres.body); err != nil {
			return
		}
		ret = remote
	} else {
		ret = local
	}

	if load_chain {
		err = ret.LoadSigChainFromServer(baseChain, leaf.public)
	} else if load_remote {
		ret.BorrowSigChainFrom(local)
	}

	if err != nil || ret == nil {
		return
	}

	// Note whether we asked for loading secrets or not...
	ret.secret = arg.LoadSecrets

	if err = ret.VerifySigChain(); err != nil {
		return
	}

	if ret.sigHints, err = LoadAndRefreshSigHints(ret.id); err != nil {
		return
	}

	// Proactively cache fetches from remote server to local storage
	if e2 := ret.Store(); e2 != nil {
		G.Log.Warning("Problem storing user %s: %s",
			name, e2.Error())
	}

	if ret.HasActiveKey() {

		if err = ret.MakeIdTable(arg.AllKeys); err != nil {
			return
		}

		if err = ret.checkKeyFingerprint(arg); err != nil {
			return
		}

		// XXX this is actually the second time we're checking this;
		// We're also checking it in VerifySigChain(); However, in this
		// case, we're looking out for revoked signature chains.
		// See https://github.com/keybase/go-libkb/issues/52
		if err = ret.VerifySelfSig(); err != nil {
			return
		}

	} else if !arg.PublicKeyOptional {

		var emsg string
		if arg.Self {
			emsg = "You don't have a public key; try `keybase push` if you have a key; or `keybase gen` if you don't"
		}
		err = NoKeyError{emsg}
		return
	}

	// We can still return a user with an Error, but never will we
	// put such a user into the Cache.
	if !arg.NoCacheResult {
		G.UserCache.Put(ret)
	}

	return
}

func (u User) HasActiveKey() bool {
	key, err := u.GetActiveKey()
	return key != nil && err == nil
}

func (u1 User) Equal(u2 User) bool {
	return (u1.id == u2.id)
}

func (u *User) GetTrackingStatementFor(s string, i UID) (link *TrackChainLink, err error) {

	uid_s := i.ToString()
	G.Log.Debug("+ GetTrackingStatement for %s", uid_s)
	defer G.Log.Debug("- GetTrackingStatement for %s -> %s", uid_s, ErrToOk(err))

	remote, e1 := u.GetRemoteTrackingStatementFor(s, i)
	local, e2 := GetLocalTrack(i)

	G.Log.Debug("| Load remote -> %v", (remote != nil))
	G.Log.Debug("| Load local -> %v", (local != nil))

	if e1 != nil && e2 != nil {
		err = e1
	} else if local == nil && remote != nil {
		link = remote
	} else if remote == nil && local != nil {
		link = local
	} else if remote.GetCTime().After(local.GetCTime()) {
		link = remote
	} else {
		link = local
	}
	return
}

func (u *User) GetRemoteTrackingStatementFor(s string, i UID) (link *TrackChainLink, err error) {
	if u.IdTable == nil {
		return nil, nil
	} else {
		return u.IdTable.GetTrackingStatementFor(s, i)
	}
}

func (u User) ToOkProofSet() *ProofSet {
	proofs := []Proof{
		{Key: "keybase", Value: u.name},
		{Key: "uid", Value: u.id.ToString()},
	}
	if fp, err := u.GetActivePgpFingerprint(); err != nil {
		proofs = append(proofs, Proof{Key: "fingerprint", Value: fp.ToString()})
	}
	if u.IdTable != nil {
		proofs = u.IdTable.ToOkProofs(proofs)
	}

	return NewProofSet(proofs)
}

func (u *User) checkKeyFingerprint(arg LoadUserArg) error {

	fp, err := u.GetActivePgpFingerprint()

	if err != nil {
		return err
	}

	if arg.Self {
		fp2 := G.Env.GetPgpFingerprint()
		if fp2 == nil {
			return NoSelectedKeyError{fp}
		} else if !fp.Eq(*fp2) {
			return WrongKeyError{fp, fp2}
		}
	}

	return nil
}

//==================================================================
