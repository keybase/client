package libkb

import (
	"sync"

	lru "github.com/hashicorp/golang-lru"
	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

// UserCache is a thin wrapper around hashicorp's LRU to store
// users locally.  It is safe for concurrent use by multiple
// goroutines.

type UserCache struct {
	lru            *lru.Cache
	lockTable      *LockTable
	resolveCacheMu sync.RWMutex
	resolveCache   map[string]ResolveResult
}

type Unlocker interface {
	Unlock()
}

func NewUserCache(c int) (*UserCache, error) {
	G.Log.Debug("Making new UserCache; size=%d", c)
	tmp, err := lru.New(c)
	if err != nil {
		return nil, err
	}
	return &UserCache{
		lru:          tmp,
		resolveCache: make(map[string]ResolveResult),
		lockTable:    NewLockTable(),
	}, nil
}

func (c *UserCache) Put(u *User) {
	c.lru.Add(u.id, u)
}

func (c *UserCache) Get(id keybase1.UID) *User {
	tmp, ok := c.lru.Get(id)
	if !ok {
		return nil
	}
	ret, ok := tmp.(*User)
	if !ok {
		G.Log.Error("Unexpected type assertion failure in UserCache")
		return nil
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
			u, err := NewUser(obj)
			if err != nil {
				return err
			}
			c.Put(u)
		}
	}
	return nil
}

func (c *UserCache) GetResolution(key string) *ResolveResult {
	c.resolveCacheMu.RLock()
	res, found := c.resolveCache[key]
	c.resolveCacheMu.RUnlock()
	if found {
		return &res
	}
	return nil
}

func (c *UserCache) PutResolution(key string, res ResolveResult) {
	res.body = nil
	c.resolveCacheMu.Lock()
	c.resolveCache[key] = res
	c.resolveCacheMu.Unlock()
}

func (c *UserCache) LockUID(uid string) Unlocker {
	return c.lockTable.Lock(uid)
}
