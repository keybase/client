package libkb

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	lru "github.com/hashicorp/golang-lru"
	keybase_1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

const (
	UID_LEN      = 16
	UID_SUFFIX   = 0x00
	UID_SUFFIX_2 = 0x19
)

type UID [UID_LEN]byte

func (u UID) String() string {
	return hex.EncodeToString(u[:])
}

func (u UID) IsZero() bool {
	for _, b := range u {
		if b != 0 {
			return false
		}
	}
	return true
}

func UidFromHex(s string) (u *UID, err error) {
	var bv []byte
	bv, err = hex.DecodeString(s)
	if err != nil {
		return
	}
	if len(bv) != UID_LEN {
		err = fmt.Errorf("Bad UID '%s'; must be %d bytes long", s, UID_LEN)
		return
	}
	if bv[len(bv)-1] != UID_SUFFIX && bv[len(bv)-1] != UID_SUFFIX_2 {
		err = fmt.Errorf("Bad UID '%s': must end in 0x%x or 0x%x", s, UID_SUFFIX, UID_SUFFIX_2)
		return
	}
	out := UID{}
	copy(out[:], bv[0:UID_LEN])
	u = &out
	return
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (u *UID) UnmarshalJSON(b []byte) error {
	v, err := UidFromHex(Unquote(b))
	if err != nil {
		return err
	}
	*u = *v
	return nil
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

//==================================================================

// UsernameToUID works for users created after "Fri Feb  6 19:33:08 EST 2015"
func UsernameToUID(s string) UID {
	h := sha256.Sum256([]byte(strings.ToLower(s)))
	var uid UID
	copy(uid[:], h[0:UID_LEN-1])
	uid[UID_LEN-1] = UID_SUFFIX_2
	return uid
}

func CheckUIDAgainstUsername(uid UID, username string) (err error) {
	u2 := UsernameToUID(username)
	if !uid.Eq(u2) {
		err = UidMismatchError{fmt.Sprintf("%s != %s (via %s)",
			uid, u2, username)}
	}
	return
}

//==================================================================

type User struct {
	// Raw JSON element read from the server or our local DB.
	basics     *jsonw.Wrapper
	publicKeys *jsonw.Wrapper
	sigs       *jsonw.Wrapper

	// Processed fields
	id       UID
	name     string
	sigChain *SigChain
	IdTable  *IdentityTable
	sigHints *SigHints
	Image    *keybase_1.Image

	// Loaded from publicKeys
	keyFamily *KeyFamily

	// Computed as a result of sigchain traversal
	cki *ComputedKeyInfos

	loggedIn bool // if we were logged in when we loaded it

	dirty bool
}

//==================================================================

type LoadUserArg struct {
	Uid               *UID
	Name              string
	PublicKeyOptional bool
	NoCacheResult     bool // currently ignore
	Self              bool
	ForceReload       bool // currently ignored
	AllKeys           bool
}

//==================================================================
// Thin wrapper around hashicorp's LRU to store users locally

type UserCache struct {
	lru          *lru.Cache
	resolveCache map[string]ResolveResult
	uidMap       map[string]UID
	lockTable    *LockTable
}

func NewUserCache(c int) (ret *UserCache, err error) {
	G.Log.Debug("Making new UserCache; size=%d", c)
	tmp, err := lru.New(c)
	if err == nil {
		ret = &UserCache{
			tmp,
			make(map[string]ResolveResult),
			make(map[string]UID),
			NewLockTable(),
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

func NewUserThin(name string, uid UID) *User {
	return &User{name: name, id: uid}
}

func NewUser(o *jsonw.Wrapper) (*User, error) {
	uid, err := GetUid(o.AtKey("id"))
	if err != nil {
		return nil, fmt.Errorf("user object lacks an ID: %s", err.Error())
	}
	name, err := o.AtKey("basics").AtKey("username").GetString()
	if err != nil {
		return nil, fmt.Errorf("user object for %s lacks a name", uid)
	}

	var imagePtr *keybase_1.Image
	pictureBlob := o.AtKey("pictures").AtKey("primary")
	if !pictureBlob.IsNil() && pictureBlob.Error() == nil {
		var image keybase_1.Image
		err = pictureBlob.UnmarshalAgain(&image)
		if err == nil {
			imagePtr = &image
		}
	}

	kf, err := ParseKeyFamily(o.AtKey("public_keys"))
	if err != nil {
		return nil, err
	}

	return &User{
		basics:     o.AtKey("basics"),
		publicKeys: o.AtKey("public_keys"),
		sigs:       o.AtKey("sigs"),
		keyFamily:  kf,
		id:         *uid,
		name:       name,
		loggedIn:   false,
		dirty:      false,
		Image:      imagePtr,
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

func LoadUserFromLocalStorage(uid UID, allKeys bool) (u *User, err error) {

	uid_s := uid.String()
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

	if u, err = NewUserFromLocalStorage(jw); err != nil {
		return nil, err
	}

	if !u.id.Eq(uid) {
		err = fmt.Errorf("Bad lookup; uid mismatch: %s != %s", uid_s, u.id)
	}

	G.Log.Debug("| Loaded username %s (uid=%s)", u.name, uid_s)
	G.Log.Debug("- LoadUserFromLocalStorage(%s,%s)", u.name, uid_s)

	return
}

func (u *User) GetKeyFamily() *KeyFamily {
	return u.keyFamily
}

func (u *User) GetComputedKeyFamily() (ret *ComputedKeyFamily) {
	if u.sigChain == nil {
		G.Log.Warning("sig chain is nil")
	}
	if u.sigChain != nil && u.keyFamily != nil {
		cki := u.sigChain.GetComputedKeyInfos()
		if cki != nil {
			ret = &ComputedKeyFamily{cki: cki, kf: u.keyFamily}
		} else {
			G.Log.Warning("cki is nil")
		}
	}
	return
}

// GetActivePgpKeys looks into the user's ComputedKeyFamily and
// returns only the active PGP keys.  If you want only sibkeys, then
// specify sibkey=true.
func (u User) GetActivePgpKeys(sibkey bool) (ret []*PgpKeyBundle) {
	if ckf := u.GetComputedKeyFamily(); ckf != nil {
		ret = ckf.GetActivePgpKeys(sibkey)
	}
	return
}

// GetActivePgpKeys looks into the user's ComputedKeyFamily and
// returns only the fingerprint of the active PGP keys.
// If you want only sibkeys, then // specify sibkey=true.
func (u User) GetActivePgpFingerprints(sibkey bool) (ret []PgpFingerprint) {
	for _, pgp := range u.GetActivePgpKeys(sibkey) {
		ret = append(ret, pgp.GetFingerprint())
	}
	return
}

func (u User) GetDeviceKID() (kid KID, err error) {
	if ckf := u.GetComputedKeyFamily(); ckf == nil {
		err = KeyFamilyError{"no key family available"}
	} else {
		kid, err = ckf.GetActiveSibkeyKidForCurrentDevice(nil)
	}
	return
}

func LoadUserFromServer(arg LoadUserArg, body *jsonw.Wrapper) (u *User, err error) {

	uid_s := arg.Uid.String()
	G.Log.Debug("+ Load User from server: %s", uid_s)

	// Res.body might already have been preloaded a a result of a Resolve call earlier.
	if body == nil {
		res, err := G.API.Get(ApiArg{
			Endpoint:    "user/lookup",
			NeedSession: false,
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

func (u *User) StoreSigChain() error {
	var err error
	if u.sigChain != nil {
		err = u.sigChain.Store()
	}
	return err
}

func (u *User) LoadSigChains(allKeys bool, f *MerkleUserLeaf) (err error) {
	u.sigChain, err = LoadSigChain(u, allKeys, f, PublicChain, u.sigChain)

	// Eventually load the others, but for now, this one is good enough
	return err
}

func (u *User) Store() error {

	G.Log.Debug("+ Store user %s", u.name)

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

	u.dirty = false
	G.Log.Debug("- Store user %s -> OK", u.name)

	return nil
}

func (u *User) StoreTopLevel() error {

	G.Log.Debug("+ StoreTopLevel")

	uid_s := u.id.String()
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
	G.Log.Debug("- StoreTopLevel -> %s", ErrToOk(err))
	return err
}

func (u *User) GetSyncedSecretKey() (ret *SKB, err error) {
	G.Log.Debug("+ User.GetSyncedSecretKey()")
	defer func() {
		G.Log.Debug("- User.GetSyncedSecretKey() -> %s", ErrToOk(err))
	}()

	if err = G.SecretSyncer.Load(u.id); err != nil {
		return
	}

	ckf := u.GetComputedKeyFamily()
	if ckf == nil {
		G.Log.Debug("| short-circuit; no Computed key family")
		return
	}

	ret, err = G.SecretSyncer.FindActiveKey(ckf)
	return
}

func LookupMerkleLeaf(uid UID, local *User) (f *MerkleUserLeaf, err error) {
	q := NewHttpArgs()
	q.Add("uid", S{uid.String()})

	f, err = G.MerkleClient.LookupUser(q)
	if err == nil && f == nil && local != nil {
		err = fmt.Errorf("User not found in server Merkle tree")
	}
	return
}

func (u *User) GetEldestFOKID() (ret *FOKID) {
	return u.keyFamily.eldest
}

func (u *User) MakeIdTable() (err error) {
	if fokid := u.GetEldestFOKID(); fokid == nil {
		err = NoKeyError{"Expected a key but didn't find one"}
	} else {
		u.IdTable = NewIdentityTable(*fokid, u.sigChain, u.sigHints)
	}
	return
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

func (u *User) VerifySelfSigByKey() (ret bool) {
	name := u.GetName()
	if ckf := u.GetComputedKeyFamily(); ckf != nil {
		ret = ckf.FindKeybaseName(name)
	}
	return
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
	} else if arg.Uid = G.GetMyUID(); arg.Uid == nil {
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
	} else if len(arg.Name) == 0 {
		err = LoadUserError{"we don't know the current user's UID or name"}
		return
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

	if my_uid := G.GetMyUID(); my_uid != nil && arg.Uid != nil &&
		my_uid.Eq(*arg.Uid) && !arg.Self {
		arg.Self = true
	}

	uid_s := uid.String()
	G.Log.Debug("| resolved to %s", uid_s)

	nlock := G.UserCache.lockTable.Lock(uid_s)
	defer nlock.Unlock()

	var local, remote *User

	if local = G.UserCache.Get(uid); local != nil {
		G.Log.Debug("| Found user in user cache: %s", uid_s)
	} else if local, err = LoadUserFromLocalStorage(uid, arg.AllKeys); err != nil {
		G.Log.Warning("Failed to load %s from storage: %s",
			uid_s, err.Error())
	}

	leaf, err := LookupMerkleLeaf(uid, local)
	if err != nil {
		return
	}

	var f1, load_remote bool

	if local == nil {
		G.Log.Debug("| No local user stored for %s", uid_s)
		load_remote = true
	} else if f1, err = local.CheckBasicsFreshness(leaf.idVersion); err != nil {
		return
	} else {
		load_remote = !f1
	}

	G.Log.Debug("| Freshness: basics=%v; for %s", f1, uid_s)

	if !load_remote {
		ret = local
	} else if remote, err = LoadUserFromServer(arg, rres.body); err != nil {
		return
	} else {
		ret = remote
	}

	if ret == nil {
		return
	}

	if err = leaf.MatchUser(ret, arg.Uid, arg.Name); err != nil {
		return
	}

	if err = ret.LoadSigChains(arg.AllKeys, leaf); err != nil {
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

		if err = ret.MakeIdTable(); err != nil {
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

	// We can still return a user with an Error, but never will we
	// put such a user into the Cache.
	G.Log.Debug("| Caching %s", uid_s)
	G.UserCache.Put(ret)

	return
}

func (u User) HasActiveKey() bool {
	if ckf := u.GetComputedKeyFamily(); ckf == nil {
		return false
	} else {
		return ckf.HasActiveKey()
	}
}

func (u1 User) Equal(u2 User) bool {
	return u1.id.Eq(u2.id)
}

func (u *User) GetTrackingStatementFor(s string, i UID) (link *TrackChainLink, err error) {

	uid_s := i.String()
	G.Log.Debug("+ GetTrackingStatement for %s", uid_s)
	defer G.Log.Debug("- GetTrackingStatement for %s -> %s", uid_s, ErrToOk(err))

	remote, e1 := u.GetRemoteTrackingStatementFor(s, i)
	local, e2 := GetLocalTrack(u.id, i)

	G.Log.Debug("| Load remote -> %v", (remote != nil))
	G.Log.Debug("| Load local -> %v", (local != nil))

	if e1 != nil && e2 != nil {
		err = e1
	} else if local == nil && remote == nil {
		// noop
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
		{Key: "uid", Value: u.id.String()},
	}
	for _, fp := range u.GetActivePgpFingerprints(true) {
		proofs = append(proofs, Proof{Key: "fingerprint", Value: fp.String()})
	}
	if u.IdTable != nil {
		proofs = u.IdTable.ToOkProofs(proofs)
	}

	return NewProofSet(proofs)
}

// localDelegateKey takes the given GenericKey and provisions it locally so that
// we can use the key without needing a refresh from the server.  The eventual
// refresh we do get from the server will clobber our work here.
func (u *User) localDelegateKey(key GenericKey, sigId *SigId, kid KID, isSibkey bool) (err error) {
	if err = u.keyFamily.LocalDelegate(key, isSibkey, kid == nil); err != nil {
		return
	}
	if u.sigChain == nil {
		err = NoSigChainError{}
		return
	}
	err = u.sigChain.LocalDelegate(u.keyFamily, key, sigId, kid, isSibkey)
	return
}

//==================================================================

func (u *User) SigChainBump(linkID LinkId, sigID *SigId) {
	u.SigChainBumpMT(MerkleTriple{LinkId: linkID, SigId: sigID})
}

func (u *User) SigChainBumpMT(mt MerkleTriple) {
	u.sigChain.Bump(mt)
}

func (u *User) GetDeviceSibkey() (GenericKey, error) {
	if u.GetComputedKeyFamily() == nil {
		return nil, fmt.Errorf("no computed key family")
	}
	if G.Env.GetDeviceID() == nil {
		return nil, fmt.Errorf("no device id")
	}
	return u.GetComputedKeyFamily().GetSibkeyForDevice(*(G.Env.GetDeviceID()))
}

func (u *User) HasDeviceInCurrentInstall() bool {
	existingDevID := G.Env.GetDeviceID()
	if existingDevID == nil || len(existingDevID) == 0 {
		return false
	}

	key, err := u.GetDeviceSibkey()
	if err != nil {
		return false
	}
	if key == nil {
		return false
	}

	return true
}
