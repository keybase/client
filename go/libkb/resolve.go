// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"fmt"
	"time"

	"runtime/debug"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/net/context"
	"stathat.com/c/ramcache"
)

type ResolveResult struct {
	uid                keybase1.UID
	teamID             keybase1.TeamID
	body               *jsonw.Wrapper
	err                error
	queriedKbUsername  string
	queriedByUID       bool
	resolvedKbUsername string
	queriedByTeamID    bool
	resolvedTeamName   string
	cachedAt           time.Time
	mutable            bool
}

func (res ResolveResult) String() string {
	return fmt.Sprintf("{uid:%s err:%s mutable:%v}", res.uid, ErrToOk(res.err), res.mutable)
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

func (res *ResolveResult) User() keybase1.User {
	return keybase1.User{
		Uid:      res.GetUID(),
		Username: res.GetNormalizedUsername().String(),
	}
}

func (res *ResolveResult) UserOrTeam() keybase1.UserOrTeamLite {
	var u keybase1.UserOrTeamLite
	if res.WasTeamIDAssertion() {
		u.Id, u.Name = res.GetTeamID().AsUserOrTeam(), res.GetTeamName()
	} else {
		u.Id, u.Name = res.GetUID().AsUserOrTeam(), res.GetNormalizedUsername().String()
	}
	return u
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

func (res *ResolveResult) WasTeamIDAssertion() bool {
	return res.queriedByTeamID
}

func (res *ResolveResult) GetTeamID() keybase1.TeamID {
	return res.teamID
}
func (res *ResolveResult) GetTeamName() string {
	return res.resolvedTeamName
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
	res = r.resolveURL(context.TODO(), au, input, withBody, false)
	return res
}

func (r *Resolver) ResolveFullExpression(ctx context.Context, input string) (res ResolveResult) {
	return r.resolveFullExpression(ctx, input, false, false)
}

func (r *Resolver) ResolveFullExpressionNeedUsername(ctx context.Context, input string) (res ResolveResult) {
	return r.resolveFullExpression(ctx, input, false, true)
}

func (r *Resolver) ResolveFullExpressionWithBody(ctx context.Context, input string) (res ResolveResult) {
	return r.resolveFullExpression(ctx, input, true, false)
}

func (r *Resolver) resolveFullExpression(ctx context.Context, input string, withBody bool, needUsername bool) (res ResolveResult) {
	defer r.G().CVTrace(ctx, VLog1, fmt.Sprintf("Resolver#resolveFullExpression(%q)", input), func() error { return res.err })()

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
	return r.resolveURL(ctx, u, input, withBody, needUsername)
}

func (res *ResolveResult) addKeybaseNameIfKnown(au AssertionURL) {
	if au.IsKeybase() && len(res.resolvedKbUsername) == 0 {
		res.resolvedKbUsername = au.GetValue()
	}
}

func (r *Resolver) getFromDiskCache(ctx context.Context, key string, au AssertionURL) (ret *ResolveResult) {
	defer r.G().CVTraceOK(ctx, VLog1, fmt.Sprintf("Resolver#getFromDiskCache(%q)", key), func() bool { return ret != nil })()
	var uid keybase1.UID
	found, err := r.G().LocalDb.GetInto(&uid, resolveDbKey(key))
	r.Stats.diskGets++
	if err != nil {
		r.G().Log.CWarningf(ctx, "Problem fetching resolve result from local DB: %s", err)
		return nil
	}
	if !found {
		r.Stats.diskGetMisses++
		return nil
	}
	if uid.IsNil() {
		r.G().Log.CWarningf(ctx, "nil UID found in disk cache")
		return nil
	}
	r.Stats.diskGetHits++
	return &ResolveResult{uid: uid}
}

func isMutable(au AssertionURL) bool {
	return !(au.IsUID() || au.IsKeybase())
}

func (r *Resolver) getFromUPAKLoader(ctx context.Context, uid keybase1.UID) (ret *ResolveResult) {
	nun, err := r.G().GetUPAKLoader().LookupUsername(ctx, uid)
	if err != nil {
		return nil
	}
	return &ResolveResult{uid: uid, queriedByUID: true, resolvedKbUsername: nun.String(), mutable: false}
}

func (r *Resolver) resolveURL(ctx context.Context, au AssertionURL, input string, withBody bool, needUsername bool) (res ResolveResult) {
	ck := au.CacheKey()

	lock := r.locktab.AcquireOnName(ctx, r.G(), ck)
	defer lock.Release(ctx)

	// Debug succintly what happened in the resolution
	var trace string
	defer func() {
		r.G().Log.CDebugf(ctx, "| Resolver#resolveURL(%s) -> %s [trace:%s]", ck, res, trace)
	}()

	// A standard keybase UID, so it's already resolved... unless we explicitly
	// need it!
	if !needUsername {
		if tmp := au.ToUID(); tmp.Exists() {
			trace += "u"
			return ResolveResult{uid: tmp}
		}
	}

	if p := r.getFromMemCache(ctx, ck, au); p != nil && (!needUsername || len(p.resolvedKbUsername) > 0) {
		trace += "m"
		return *p
	}

	if p := r.getFromDiskCache(ctx, ck, au); p != nil && (!needUsername || len(p.resolvedKbUsername) > 0) {
		p.mutable = isMutable(au)
		r.putToMemCache(ck, *p)
		trace += "d"
		return *p
	}

	// We can check the UPAK loader for the username if we're just mapping a UID to a username.
	if tmp := au.ToUID(); !withBody && tmp.Exists() {
		if p := r.getFromUPAKLoader(ctx, tmp); p != nil {
			trace += "l"
			r.putToMemCache(ck, *p)
			return *p
		}
	}

	trace += "s"
	res = r.resolveURLViaServerLookup(ctx, au, input, withBody)

	// Cache for a shorter period of time if it's not a Keybase identity
	res.mutable = isMutable(au)
	r.putToMemCache(ck, res)

	// We only put to disk cache if it's a Keybase-type assertion. In particular, UIDs
	// are **not** stored to disk.
	if au.IsKeybase() {
		trace += "p"
		r.putToDiskCache(ctx, ck, res)
	}

	return res
}

func (r *Resolver) resolveURLViaServerLookup(ctx context.Context, au AssertionURL, input string, withBody bool) (res ResolveResult) {
	defer r.G().CVTrace(ctx, VLog1, fmt.Sprintf("Resolver#resolveURLViaServerLookup(input = %q)", input), func() error { return res.err })()

	if au.IsTeamID() {
		ateam, ok := au.(AssertionTeamID)
		if !ok {
			res.err = errors.New("au.IsTeamID() == true, but failed type cast")
			return res
		}
		return r.resolveTeamIDViaServerLookup(ctx, ateam)
	}

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
		SessionType:    APISessionTypeNONE,
		Args:           ha,
		AppStatusCodes: []int{SCOk, SCNotFound, SCDeleted},
		NetContext:     ctx,
	})

	if res.err != nil {
		r.G().Log.CDebugf(ctx, "API user/lookup %q error: %s", input, res.err)
		return
	}
	switch ares.AppStatus.Code {
	case SCNotFound:
		r.G().Log.CDebugf(ctx, "API user/lookup %q not found", input)
		res.err = NotFoundError{}
		return
	case SCDeleted:
		r.G().Log.CDebugf(ctx, "API user/lookup %q deleted", input)
		res.err = DeletedError{Msg: fmt.Sprintf("user %q deleted", input)}
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

type teamLookup struct {
	ID     keybase1.TeamID        `json:"id"`
	Name   keybase1.TeamNameParts `json:"name"`
	Status AppStatus              `json:"status"`
}

func (t *teamLookup) GetAppStatus() *AppStatus {
	return &t.Status
}

func (r *Resolver) resolveTeamIDViaServerLookup(ctx context.Context, ateam AssertionTeamID) (res ResolveResult) {
	res.queriedByTeamID = true
	key, val, err := ateam.ToLookup()
	if err != nil {
		res.err = err
		return res
	}

	arg := NewRetryAPIArg("team/get")
	arg.NetContext = ctx
	arg.SessionType = APISessionTypeREQUIRED
	arg.Args = make(HTTPArgs)
	arg.Args[key] = S{Val: val}
	arg.Args["lookup_only"] = B{Val: true}

	var lookup teamLookup
	if err := r.G().API.GetDecode(arg, &lookup); err != nil {
		res.err = err
		return res
	}
	res.resolvedTeamName = lookup.Name.String()

	return res
}

type ResolveCacheStats struct {
	misses          int
	timeouts        int
	mutableTimeouts int
	errorTimeouts   int
	hits            int
	diskGets        int
	diskGetHits     int
	diskGetMisses   int
	diskPuts        int
}

type Resolver struct {
	Contextified
	cache   *ramcache.Ramcache
	Stats   ResolveCacheStats
	NowFunc func() time.Time
	locktab LockTable
}

func (s ResolveCacheStats) Eq(m, t, mt, et, h int) bool {
	return (s.misses == m) && (s.timeouts == t) && (s.mutableTimeouts == mt) && (s.errorTimeouts == et) && (s.hits == h)
}

func (s ResolveCacheStats) EqWithDiskHits(m, t, mt, et, h, dh int) bool {
	return (s.misses == m) && (s.timeouts == t) && (s.mutableTimeouts == mt) && (s.errorTimeouts == et) && (s.hits == h) && (s.diskGetHits == dh)
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

func (r *Resolver) getFromMemCache(ctx context.Context, key string, au AssertionURL) (ret *ResolveResult) {
	defer r.G().CVTraceOK(ctx, VLog1, fmt.Sprintf("Resolver#getFromMemCache(%q)", key), func() bool { return ret != nil })()
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
	// Should never happen, but don't corrupt application state if it does
	if rres.uid.IsNil() {
		r.G().Log.CInfof(ctx, "Resolver#getFromMemCache: nil UID in cache")
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
	rres.addKeybaseNameIfKnown(au)
	return rres
}

func resolveDbKey(key string) DbKey {
	return DbKey{
		Typ: DBResolveUsernameToUID,
		Key: NewNormalizedUsername(key).String(),
	}
}

func (r *Resolver) putToDiskCache(ctx context.Context, key string, res ResolveResult) {
	r.G().VDL.CLogf(ctx, VLog1, "| Resolver#putToDiskCache (attempt) %+v", res)
	// Only cache immutable resolutions to disk
	if res.mutable {
		return
	}
	// Don't cache errors
	if res.err != nil {
		return
	}
	if res.uid.IsNil() {
		r.G().Log.CWarningf(ctx, "Mistaken UID put to disk cache")
		if r.G().Env.GetDebug() {
			debug.PrintStack()
		}
		return
	}
	r.Stats.diskPuts++
	err := r.G().LocalDb.PutObj(resolveDbKey(key), nil, res.uid)
	if err != nil {
		r.G().Log.CWarningf(ctx, "Cannot put resolve result to disk: %s", err)
		return
	}
	r.G().Log.CDebugf(ctx, "| Resolver#putToDiskCache(%s) -> %v", key, res)
}

// Put receives a copy of a ResolveResult, clears out the body
// to avoid caching data that can go stale, and stores the result.
func (r *Resolver) putToMemCache(key string, res ResolveResult) {
	if r.cache == nil {
		return
	}
	// Don't cache errors
	if res.err != nil {
		return
	}
	if res.uid.IsNil() {
		r.G().Log.Warning("Mistaken UID put to mem cache")
		if r.G().Env.GetDebug() {
			debug.PrintStack()
		}
		return
	}
	res.cachedAt = r.NowFunc()
	res.body = nil // Don't cache body
	r.cache.Set(key, &res)
}
