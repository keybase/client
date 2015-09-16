package libkb

import (
	"fmt"
	"sync"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

//==================================================================

type ResolveResult struct {
	uid        keybase1.UID
	body       *jsonw.Wrapper
	err        error
	kbUsername string
}

func (res *ResolveResult) GetUID() keybase1.UID {
	return res.uid
}

func (res *ResolveResult) GetError() error {
	return res.err
}

func ResolveUID(input string) (res ResolveResult) {
	G.Log.Debug("+ Resolving username %s", input)
	var au AssertionURL
	if au, res.err = ParseAssertionURL(input, false); res.err != nil {
		return
	}
	res = resolveUID(au)
	return
}

func ResolveUIDValuePair(key, value string) (res ResolveResult) {
	G.Log.Debug("+ Resolve username (%s,%s)", key, value)

	var au AssertionURL
	if au, res.err = ParseAssertionURLKeyValue(key, value, false); res.err != nil {
		res = resolveUID(au)
	}

	G.Log.Debug("- Resolve username (%s,%s) -> %v", key, value, res.uid)
	return
}

func resolveUID(au AssertionURL) ResolveResult {
	// A standard keybase UID, so it's already resolved
	if tmp := au.ToUID(); tmp.Exists() {
		return ResolveResult{uid: tmp}
	}

	ck := au.CacheKey()

	if G.ResolveCache == nil {
		return ResolveResult{}
	}

	if p := G.ResolveCache.Get(ck); p != nil {
		return *p
	}

	r := resolveUsername(au)

	if r.err != nil {
		// Don't add to the cache if the resolve failed.
		return r
	}

	if !au.IsKeybase() {
		// Don't add to the cache if it's a mutable identity.
		return r
	}

	G.ResolveCache.Put(ck, r)
	return r
}

func resolveUsername(au AssertionURL) (res ResolveResult) {

	var key, val string
	var ares *APIRes
	var l int

	if au.IsKeybase() {
		res.kbUsername = au.GetValue()
	}

	if key, val, res.err = au.ToLookup(); res.err != nil {
		return
	}

	ha := HTTPArgsFromKeyValuePair(key, S{val})
	ha.Add("multi", I{1})
	ares, res.err = G.API.Get(APIArg{
		Endpoint:    "user/lookup",
		NeedSession: false,
		Args:        ha,
	})

	if res.err != nil {
		return
	}

	var them *jsonw.Wrapper
	if them, res.err = ares.Body.AtKey("them").ToArray(); res.err != nil {
		return
	}

	if l, res.err = them.Len(); res.err != nil {
		return
	}

	if l == 0 {
		res.err = fmt.Errorf("No resolution found for %s", au)
	} else if l > 1 {
		res.err = fmt.Errorf("Identity '%s' is ambiguous", au)
	} else {
		res.body = them.AtIndex(0)
		res.uid, res.err = GetUID(res.body.AtKey("id"))
	}

	return
}

type ResolveCache struct {
	results map[string]ResolveResult
	sync.RWMutex
}

func NewResolveCache() *ResolveCache {
	return &ResolveCache{results: make(map[string]ResolveResult)}
}

// Get returns a ResolveResult, if present in the cache.
func (c *ResolveCache) Get(key string) *ResolveResult {
	c.RLock()
	res, found := c.results[key]
	c.RUnlock()
	if found {
		return &res
	}
	return nil
}

// Put receives a copy of a ResolveResult, clears out the body
// to avoid caching data that can go stale, and stores the result.
func (c *ResolveCache) Put(key string, res ResolveResult) {
	res.body = nil
	c.Lock()
	c.results[key] = res
	c.Unlock()
}
