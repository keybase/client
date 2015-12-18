// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
	"stathat.com/c/ramcache"
	"time"
)

type ResolveResult struct {
	uid        keybase1.UID
	body       *jsonw.Wrapper
	err        error
	kbUsername string
	cachedAt   time.Time
	mutable    bool
}

const (
	resolveCacheTTL           = 12 * time.Hour
	resolveCacheMaxAge        = 12 * time.Hour
	resolveCacheMaxAgeMutable = 20 * time.Minute
	resolveCacheMaxAgeErrored = 5 * time.Second
)

func (res *ResolveResult) GetUID() keybase1.UID {
	return res.uid
}

func (res *ResolveResult) GetError() error {
	return res.err
}

func (r *Resolver) ResolveWithBody(input string) ResolveResult {
	return r.resolve(input, true)
}

func (r *Resolver) Resolve(input string) ResolveResult {
	return r.resolve(input, false)
}

func (r *Resolver) resolve(input string, withBody bool) (res ResolveResult) {
	r.G().Log.Debug("+ Resolving username %s", input)
	var au AssertionURL
	if au, res.err = ParseAssertionURL(input, false); res.err != nil {
		return
	}
	res = r.resolveURL(au, input, withBody)
	return
}

func (r *Resolver) ResolveFullExpression(input string) (res ResolveResult) {
	var expr AssertionExpression
	expr, res.err = AssertionParseAndOnly(input)
	if res.err != nil {
		return res
	}
	u := FindBestIdentifyComponentURL(expr)
	if u == nil {
		res.err = ResolutionError{Input: input, Msg: "Cannot find a resolvable factor"}
		return res
	}
	return r.resolveURL(u, input, false)
}

func (r *Resolver) resolveURL(au AssertionURL, input string, withBody bool) ResolveResult {
	// A standard keybase UID, so it's already resolved
	if tmp := au.ToUID(); tmp.Exists() {
		return ResolveResult{uid: tmp}
	}

	ck := au.CacheKey()

	if p := r.getCache(ck); p != nil {
		return *p
	}

	res := r.resolveURLViaServerLookup(au, input, withBody)

	// Cache for a shorter period of time if it's not a Keybase identity
	res.mutable = !au.IsKeybase()

	r.putCache(ck, res)
	return res
}

func (r *Resolver) resolveURLViaServerLookup(au AssertionURL, input string, withBody bool) (res ResolveResult) {

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
	fields := "basics"
	if withBody {
		fields += ",public_keys,pictures"
	}
	ha.Add("fields", S{fields})
	ares, res.err = r.G().API.Get(APIArg{
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
		res.err = ResolutionError{Input: input, Msg: "No resolution found"}
	} else if l > 1 {
		res.err = ResolutionError{Input: input, Msg: "Identify is ambiguous"}
	} else {
		res.body = them.AtIndex(0)
		res.uid, res.err = GetUID(res.body.AtKey("id"))
	}

	return
}

type resolveCacheStats struct {
	misses          int
	timeouts        int
	mutableTimeouts int
	errorTimeouts   int
	hits            int
}

type Resolver struct {
	Contextified
	cache   *ramcache.Ramcache
	stats   resolveCacheStats
	nowFunc func() time.Time
}

func (s resolveCacheStats) eq(m, t, mt, et, h int) bool {
	return (s.misses == m) && (s.timeouts == t) && (s.mutableTimeouts == mt) && (s.errorTimeouts == et) && (s.hits == h)
}

func NewResolver(g *GlobalContext) *Resolver {
	return &Resolver{
		Contextified: NewContextified(g),
		cache:        nil,
		nowFunc:      func() time.Time { return time.Now() },
	}
}

func (r *Resolver) EnableCaching() {
	cache := ramcache.New()
	cache.MaxAge = resolveCacheMaxAge
	cache.TTL = resolveCacheTTL
	r.cache = cache
}

func (r *Resolver) getCache(key string) *ResolveResult {
	if r.cache == nil {
		return nil
	}
	res, _ := r.cache.Get(key)
	if res == nil {
		r.stats.misses++
		return nil
	}
	rres, ok := res.(*ResolveResult)
	if !ok {
		r.stats.misses++
		return nil
	}
	now := r.nowFunc()
	if now.Sub(rres.cachedAt) > resolveCacheMaxAge {
		r.stats.timeouts++
		return nil
	}
	if rres.mutable && now.Sub(rres.cachedAt) > resolveCacheMaxAgeMutable {
		r.stats.mutableTimeouts++
		return nil
	}
	if rres.err != nil && now.Sub(rres.cachedAt) > resolveCacheMaxAgeErrored {
		r.stats.errorTimeouts++
		return nil
	}
	r.stats.hits++
	return rres
}

// Put receives a copy of a ResolveResult, clears out the body
// to avoid caching data that can go stale, and stores the result.
func (r *Resolver) putCache(key string, res ResolveResult) {
	if r.cache == nil {
		return
	}
	res.body = nil
	res.cachedAt = r.nowFunc()
	r.cache.Set(key, &res)
}
