package libkb

import (
	"fmt"

	jsonw "github.com/keybase/go-jsonw"
)

//==================================================================

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

//==================================================================

type ResolveResult struct {
	uid        *UID
	body       *jsonw.Wrapper
	err        error
	kbUsername string
}

func (res *ResolveResult) GetUid() *UID {
	return res.uid
}

func (res *ResolveResult) GetError() error {
	return res.err
}

func ResolveUid(input string) (res ResolveResult) {
	G.Log.Debug("+ Resolving username %s", input)
	var au AssertionUrl
	if au, res.err = ParseAssertionUrl(input, false); res.err != nil {
		return
	}
	res = _resolveUid(au)
	return
}

func ResolveUidValuePair(key, value string) (res ResolveResult) {
	G.Log.Debug("+ Resolve username (%s,%s)", key, value)

	var au AssertionUrl
	if au, res.err = ParseAssertionUrlKeyValue(key, value, false); res.err != nil {
		res = _resolveUid(au)
	}

	G.Log.Debug("- Resolve username (%s,%s) -> %v", key, value, res.uid)
	return
}

func _resolveUid(au AssertionUrl) ResolveResult {
	// A standard keybase UID, so it's already resolved
	if tmp := au.ToUid(); tmp != nil {
		return ResolveResult{uid: tmp}
	}

	ck := au.CacheKey()

	if G.UserCache == nil {
		return ResolveResult{}
	}

	if p := G.UserCache.GetResolution(ck); p != nil {
		return *p
	}

	r := __resolveUsername(au)
	G.UserCache.PutResolution(ck, r)

	return r
}

func __resolveUsername(au AssertionUrl) (res ResolveResult) {

	var key, val string
	var ares *ApiRes
	var l int

	if au.IsKeybase() {
		res.kbUsername = au.GetValue()
	}

	if key, val, res.err = au.ToLookup(); res.err != nil {
		return
	}

	ha := HttpArgsFromKeyValuePair(key, S{val})
	ha.Add("multi", I{1})
	ares, res.err = G.API.Get(ApiArg{
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

	// Aggressive caching of incidental data...
	G.UserCache.CacheServerGetVector(them)

	if l == 0 {
		res.err = fmt.Errorf("No resolution found for %s", au)
	} else if l > 1 {
		res.err = fmt.Errorf("Identity '%s' is ambiguous", au)
	} else {
		res.body = them.AtIndex(0)
		res.uid, res.err = GetUid(res.body.AtKey("id"))
	}

	return
}
