package libkb

import (
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
}

type LoadUserArg struct {
	nameKey          string // Currently: username, twitter, github, etc...
	nameValue        string
	requirePublicKey bool
	cacheResult      bool
	self             bool
	loadSecrets      bool
}

type UserCache struct {
	lru *lru.Cache
}

func NewUserCache(c int) (ret *UserCache, err error) {
	G.Log.Debug("Making new UserCache; size=%d", c)
	tmp, err := lru.New(c)
	if err == nil {
		ret = &UserCache{tmp}
	}
	return ret, err
}

func (c *UserCache) Store(u *User) {
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

func LoadUser(arg LoadUserArg) (u *User, err error) {
	return nil, nil
}
