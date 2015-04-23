package libkb

import (
	"sync"

	lru "github.com/hashicorp/golang-lru"
	jsonw "github.com/keybase/go-jsonw"
)

// Thin wrapper around hashicorp's LRU to store users locally

type UserCache struct {
	lru          *lru.Cache
	lockTable    *LockTable
	resolveCache map[string]ResolveResult
	uidMapMu     sync.RWMutex
	uidMap       map[string]UID
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
		uidMap:       make(map[string]UID),
		lockTable:    NewLockTable(),
	}, nil
}

func (c *UserCache) Put(u *User) {
	c.lru.Add(u.id, u)
	c.uidMapMu.Lock()
	c.uidMap[u.GetName()] = u.GetUid()
	c.uidMapMu.Unlock()
}

func (c *UserCache) Get(id UID) *User {
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

func (c *UserCache) GetByName(s string) *User {
	c.uidMapMu.RLock()
	uid, ok := c.uidMap[s]
	c.uidMapMu.RUnlock()
	if !ok {
		return nil
	}
	return c.Get(uid)
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
	res, found := c.resolveCache[key]
	if found {
		return &res
	} else {
		return nil
	}
}

func (c *UserCache) PutResolution(key string, res ResolveResult) {
	res.body = nil
	c.resolveCache[key] = res
}

func (c *UserCache) LockUID(uid string) Unlocker {
	return c.lockTable.Lock(uid)
}
