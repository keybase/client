package libkb

import (
	"code.google.com/p/go.crypto/openpgp"
	"github.com/hashicorp/golang-lru"
	"github.com/keybase/go-jsonw"
)

type UID string

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

	verified  bool
	activeKey *openpgp.Entity
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
			u := NewUser(obj)
			c.Put(u)
		}
	}
	return nil
}

//==================================================================

func NewUser(o *jsonw.Wrapper) *User {
	return &User{}
}

func LoadUser(arg LoadUserArg) (u *User, err error) {

	return nil, nil
}
