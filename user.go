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

	verified             CachedVerification
	activeKey            *PgpKeyBundle
	activePgpFingerprint *PgpFingerprint
}

//==================================================================
// Thin wrapper around hashicorp's LRU to store users locally

type LoadUserArg struct {
	name             string
	requirePublicKey bool
	cacheResult      bool
	self             bool
	loadSecrets      bool
	forceReload      bool
}

type ResolveResult struct {
	res string
	err error
}

type UserCache struct {
	lru          *lru.Cache
	resolveCache map[string]ResolveResult
}

func NewUserCache(c int) (ret *UserCache, err error) {
	G.Log.Debug("Making new UserCache; size=%d", c)
	tmp, err := lru.New(c)
	if err == nil {
		ret = &UserCache{tmp, make(map[string]ResolveResult)}
	}
	return ret, err
}

func (c *UserCache) Put(u *User) {
	c.lru.Add(u.id, u)
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
		verified:    CachedVerification{false, nil, nil, 0},
	}, nil
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

func (u *User) LoadSigChainFromStorage() error {
	if f, err := u.GetActivePgpFingerprint(); err != nil {
		return err
	} else if u.sigs != nil && f != nil {
		last := u.sigs.AtKey("last")
		seqno, e1 := last.AtKey("seqno").GetInt()
		lh, e2 := last.AtKey("payload_host").GetString()
		if e1 == nil && e2 == nil {
			if lid, e3 := LinkIdFromHex(lh); e3 != nil {
				return fmt.Errorf("Bad sigchain tail for user %s: %s",
					u.name, lh)
			} else {
				u.sigChain = NewSigChain(u.id, seqno, lid, f)
			}
		}
	}
	if u.sigChain == nil {
		G.Log.Debug("Empty sigchain for %s", u.name)
		u.sigChain = NewEmptySigChain(u.id)
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

func LoadUser(arg LoadUserArg) (u *User, err error) {

	var name string

	name, err = ResolveUsername(arg.name)
	if err != nil {
		return
	}

	u, err = LoadUserFromLocalStorage(name)
	if err != nil {
		return
	}

	return
}

//==================================================================
