// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	"stathat.com/c/ramcache"
)

type ResolveResult struct {
	uid                keybase1.UID
	body               *jsonw.Wrapper
	err                error
	queriedKbUsername  string
	queriedByUID       bool
	resolvedKbUsername string
	cachedAt           time.Time
	mutable            bool
}

const (
	resolveCacheTTL           = 12 * time.Hour
	ResolveCacheMaxAge        = 12 * time.Hour
	ResolveCacheMaxAgeMutable = 20 * time.Minute
	resolveCacheMaxAgeErrored = 5 * time.Second
)

func (res *ResolveResult) GetUID() keybase1.UID {
	return res.uid
}

func (res *ResolveResult) GetUsername() string {
	return res.resolvedKbUsername
}
func (res *ResolveResult) GetNormalizedUsername() NormalizedUsername {
	return NewNormalizedUsername(res.GetUsername())
}
func (res *ResolveResult) GetNormalizedQueriedUsername() NormalizedUsername {
	return NewNormalizedUsername(res.queriedKbUsername)
}

func (res *ResolveResult) WasKBAssertion() bool {
	return res.queriedKbUsername != "" || res.queriedByUID
}

func (res *ResolveResult) GetError() error {
	return res.err
}

func (res *ResolveResult) GetBody() *jsonw.Wrapper {
	return res.body
}

func (r *Resolver) ResolveWithBody(input string) ResolveResult {
	return r.resolve(input, true)
}

func (r *Resolver) Resolve(input string) ResolveResult {
	return r.resolve(input, false)
}

func (r *Resolver) resolve(input string, withBody bool) (res ResolveResult) {
	defer r.G().Trace(fmt.Sprintf("Resolving username %q", input), func() error { return res.err })()

	var au AssertionURL
	if au, res.err = ParseAssertionURL(r.G().MakeAssertionContext(), input, false); res.err != nil {
		return res
	}
	res = r.resolveURL(au, input, withBody, false)
	return res
}

func (r *Resolver) ResolveFullExpression(input string) (res ResolveResult) {
	return r.resolveFullExpression(input, false, false)
}

func (r *Resolver) ResolveFullExpressionNeedUsername(input string) (res ResolveResult) {
	return r.resolveFullExpression(input, false, true)
}

func (r *Resolver) ResolveFullExpressionWithBody(input string) (res ResolveResult) {
	return r.resolveFullExpression(input, true, false)
}

func (r *Resolver) resolveFullExpression(input string, withBody bool, needUsername bool) (res ResolveResult) {
	defer r.G().Trace(fmt.Sprintf("Resolving full expression %q", input), func() error { return res.err })()

	var expr AssertionExpression
	expr, res.err = AssertionParseAndOnly(r.G().MakeAssertionContext(), input)
	if res.err != nil {
		return res
	}
	u := FindBestIdentifyComponentURL(expr)
	if u == nil {
		res.err = ResolutionError{Input: input, Msg: "Cannot find a resolvable factor"}
		return res
	}
	return r.resolveURL(u, input, withBody, needUsername)
}

func (r *Resolver) resolveURL(au AssertionURL, input string, withBody bool, needUsername bool) ResolveResult {

	// A standard keybase UID, so it's already resolved... unless we explicitly
	// need it!
	if !needUsername {
		if tmp := au.ToUID(); tmp.Exists() {
			return ResolveResult{uid: tmp}
		}
	}

	ck := au.CacheKey()

	if p := r.getCache(ck); p != nil && (!needUsername || len(p.resolvedKbUsername) > 0) {
		return *p
	}

	res := r.resolveURLViaServerLookup(au, input, withBody)

	// Cache for a shorter period of time if it's not a Keybase identity
	res.mutable = !au.IsKeybase()

	r.putCache(ck, res)
	return res
}

func (r *Resolver) resolveURLViaServerLookup(au AssertionURL, input string, withBody bool) (res ResolveResult) {
	defer r.G().Trace(fmt.Sprintf("resolveURLViaServerLookup(input = %q)", input), func() error { return res.err })()

	var key, val string
	var ares *APIRes
	var l int

	if au.IsKeybase() {
		res.queriedKbUsername = au.GetValue()
	} else if au.IsUID() {
		res.queriedByUID = true
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
		Endpoint:       "user/lookup",
		NeedSession:    false,
		Args:           ha,
		AppStatusCodes: []int{SCOk, SCNotFound},
	})

	if res.err != nil {
		r.G().Log.Debug("API user/lookup %q error: %s", input, res.err)
		return
	}
	if ares.AppStatus.Code == SCNotFound {
		r.G().Log.Debug("API user/lookup %q not found", input)
		res.err = NotFoundError{}
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
		if res.err == nil {
			res.resolvedKbUsername, res.err = res.body.AtPath("basics.username").GetString()
		}
	}

	return
}

type ResolveCacheStats struct {
	misses          int
	timeouts        int
	mutableTimeouts int
	errorTimeouts   int
	hits            int
}

type Resolver struct {
	Contextified
	cache   *ramcache.Ramcache
	Stats   ResolveCacheStats
	NowFunc func() time.Time
}

func (s ResolveCacheStats) Eq(m, t, mt, et, h int) bool {
	return (s.misses == m) && (s.timeouts == t) && (s.mutableTimeouts == mt) && (s.errorTimeouts == et) && (s.hits == h)
}

func NewResolver(g *GlobalContext) *Resolver {
	return &Resolver{
		Contextified: NewContextified(g),
		cache:        nil,
		NowFunc:      func() time.Time { return time.Now() },
	}
}

func (r *Resolver) EnableCaching() {
	cache := ramcache.New()
	cache.MaxAge = ResolveCacheMaxAge
	cache.TTL = resolveCacheTTL
	r.cache = cache
}

func (r *Resolver) Shutdown() {
	if r.cache == nil {
		return
	}
	r.cache.Shutdown()
}

func (r *Resolver) getCache(key string) *ResolveResult {
	if r.cache == nil {
		return nil
	}
	res, _ := r.cache.Get(key)
	if res == nil {
		r.Stats.misses++
		return nil
	}
	rres, ok := res.(*ResolveResult)
	if !ok {
		r.Stats.misses++
		return nil
	}
	now := r.NowFunc()
	if now.Sub(rres.cachedAt) > ResolveCacheMaxAge {
		r.Stats.timeouts++
		return nil
	}
	if rres.mutable && now.Sub(rres.cachedAt) > ResolveCacheMaxAgeMutable {
		r.Stats.mutableTimeouts++
		return nil
	}
	if rres.err != nil && now.Sub(rres.cachedAt) > resolveCacheMaxAgeErrored {
		r.Stats.errorTimeouts++
		return nil
	}
	r.Stats.hits++
	return rres
}

// Put receives a copy of a ResolveResult, clears out the body
// to avoid caching data that can go stale, and stores the result.
func (r *Resolver) putCache(key string, res ResolveResult) {
	if r.cache == nil {
		return
	}
	res.cachedAt = r.NowFunc()
	res.body = nil // Don't cache body
	r.cache.Set(key, &res)
}
