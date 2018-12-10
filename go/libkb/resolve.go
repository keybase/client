// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"time"

	"runtime/debug"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
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
	resolvedTeamName   keybase1.TeamName
	cachedAt           time.Time
	mutable            bool
	deleted            bool
	isCompound         bool
	isServerTrust      bool
}

func (res ResolveResult) HasPrimaryKey() bool {
	return res.uid.Exists() || res.teamID.Exists()
}

func (res ResolveResult) String() string {
	return fmt.Sprintf("{uid:%s teamID:%s err:%s mutable:%v}", res.uid, res.teamID, ErrToOk(res.err), res.mutable)
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

func (res *ResolveResult) SetUIDForTesting(u keybase1.UID) {
	res.uid = u
}

func (res *ResolveResult) User() keybase1.User {
	return keybase1.User{
		Uid:      res.GetUID(),
		Username: res.GetNormalizedUsername().String(),
	}
}

func (res *ResolveResult) UserOrTeam() keybase1.UserOrTeamLite {
	var u keybase1.UserOrTeamLite
	if res.GetUID().Exists() {
		u.Id, u.Name = res.GetUID().AsUserOrTeam(), res.GetNormalizedUsername().String()
	} else if res.GetTeamID().Exists() {
		u.Id, u.Name = res.GetTeamID().AsUserOrTeam(), res.GetTeamName().String()
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
func (res *ResolveResult) GetTeamName() keybase1.TeamName {
	return res.resolvedTeamName
}

func (res *ResolveResult) WasKBAssertion() bool {
	return (res.queriedKbUsername != "" && !res.isCompound) || res.queriedByUID
}

func (res *ResolveResult) GetError() error {
	return res.err
}

func (res *ResolveResult) GetBody() *jsonw.Wrapper {
	return res.body
}

func (res *ResolveResult) GetDeleted() bool {
	return res.deleted
}

func (res ResolveResult) FailOnDeleted() ResolveResult {
	if res.deleted {
		label := res.uid.String()
		if res.resolvedKbUsername != "" {
			label = res.resolvedKbUsername
		}
		res.err = UserDeletedError{Msg: fmt.Sprintf("user %q deleted", label)}
	}
	return res
}

func (res ResolveResult) IsServerTrust() bool {
	return res.isServerTrust
}

func (r *ResolverImpl) ResolveWithBody(m MetaContext, input string) ResolveResult {
	return r.resolve(m, input, true)
}

func (r *ResolverImpl) Resolve(m MetaContext, input string) ResolveResult {
	return r.resolve(m, input, false)
}

func (r *ResolverImpl) resolve(m MetaContext, input string, withBody bool) (res ResolveResult) {
	defer m.CTraceTimed(fmt.Sprintf("Resolving username %q", input), func() error { return res.err })()

	var au AssertionURL
	if au, res.err = ParseAssertionURL(m.G().MakeAssertionContext(), input, false); res.err != nil {
		return res
	}
	res = r.resolveURL(m, au, input, withBody, false)
	return res
}

func (r *ResolverImpl) ResolveFullExpression(m MetaContext, input string) (res ResolveResult) {
	return r.resolveFullExpression(m, input, false, false)
}

func (r *ResolverImpl) ResolveFullExpressionNeedUsername(m MetaContext, input string) (res ResolveResult) {
	return r.resolveFullExpression(m, input, false, true)
}

func (r *ResolverImpl) ResolveFullExpressionWithBody(m MetaContext, input string) (res ResolveResult) {
	return r.resolveFullExpression(m, input, true, false)
}

func (r *ResolverImpl) ResolveUser(m MetaContext, assertion string) (u keybase1.User, res ResolveResult, err error) {
	res = r.ResolveFullExpressionNeedUsername(m, assertion)
	err = res.GetError()
	if err != nil {
		return u, res, err
	}
	u = res.User()
	if !u.Uid.Exists() {
		return u, res, fmt.Errorf("no resolution for: %v", assertion)
	}
	return u, res, nil
}

func (r *ResolverImpl) resolveFullExpression(m MetaContext, input string, withBody bool, needUsername bool) (res ResolveResult) {
	defer m.CVTrace(VLog1, fmt.Sprintf("Resolver#resolveFullExpression(%q)", input), func() error { return res.err })()

	var expr AssertionExpression
	expr, res.err = AssertionParseAndOnly(m.G().MakeAssertionContext(), input)
	if res.err != nil {
		return res
	}
	u := FindBestIdentifyComponentURL(expr)
	if u == nil {
		res.err = ResolutionError{Input: input, Msg: "Cannot find a resolvable factor"}
		return res
	}
	ret := r.resolveURL(m, u, input, withBody, needUsername)
	ret.isCompound = len(expr.CollectUrls(nil)) > 1
	return ret
}

func (res *ResolveResult) addKeybaseNameIfKnown(au AssertionURL) {
	if au.IsKeybase() && len(res.resolvedKbUsername) == 0 {
		res.resolvedKbUsername = au.GetValue()
	}
}

func (r *ResolverImpl) getFromDiskCache(m MetaContext, key string, au AssertionURL) (ret *ResolveResult) {
	defer m.CVTraceOK(VLog1, fmt.Sprintf("Resolver#getFromDiskCache(%q)", key), func() bool { return ret != nil })()
	var uid keybase1.UID
	found, err := m.G().LocalDb.GetInto(&uid, resolveDbKey(key))
	r.Stats.diskGets++
	if err != nil {
		m.CWarningf("Problem fetching resolve result from local DB: %s", err)
		return nil
	}
	if !found {
		r.Stats.diskGetMisses++
		return nil
	}
	if uid.IsNil() {
		m.CWarningf("nil UID found in disk cache")
		return nil
	}
	r.Stats.diskGetHits++
	return &ResolveResult{uid: uid}
}

func isMutable(au AssertionURL) bool {
	isStatic := au.IsUID() ||
		au.IsKeybase() ||
		(au.IsTeamID() && !au.ToTeamID().IsSubTeam()) ||
		(au.IsTeamName() && au.ToTeamName().IsRootTeam())
	return !isStatic
}

func (r *ResolverImpl) getFromUPAKLoader(m MetaContext, uid keybase1.UID) (ret *ResolveResult) {
	nun, err := m.G().GetUPAKLoader().LookupUsername(m.Ctx(), uid)
	if err != nil {
		return nil
	}
	return &ResolveResult{uid: uid, queriedByUID: true, resolvedKbUsername: nun.String(), mutable: false}
}

func (r *ResolverImpl) resolveURL(m MetaContext, au AssertionURL, input string, withBody bool, needUsername bool) (res ResolveResult) {
	ck := au.CacheKey()

	lock := r.locktab.AcquireOnName(m.Ctx(), m.G(), ck)
	defer lock.Release(m.Ctx())

	// Debug succinctly what happened in the resolution
	var trace string
	defer func() {
		m.CDebugf("| Resolver#resolveURL(%s) -> %s [trace:%s]", ck, res, trace)
	}()

	// A standard keybase UID, so it's already resolved... unless we explicitly
	// need it!
	if !needUsername {
		if tmp := au.ToUID(); tmp.Exists() {
			trace += "u"
			return ResolveResult{uid: tmp}
		}
	}

	if p := r.getFromMemCache(m, ck, au); p != nil && (!needUsername || len(p.resolvedKbUsername) > 0 || !p.resolvedTeamName.IsNil()) {
		trace += "m"
		ret := *p
		ret.decorate(au)
		return ret
	}

	if p := r.getFromDiskCache(m, ck, au); p != nil && (!needUsername || len(p.resolvedKbUsername) > 0 || !p.resolvedTeamName.IsNil()) {
		p.mutable = isMutable(au)
		r.putToMemCache(m, ck, *p)
		trace += "d"
		ret := *p
		ret.decorate(au)
		return ret
	}

	// We can check the UPAK loader for the username if we're just mapping a UID to a username.
	if tmp := au.ToUID(); !withBody && tmp.Exists() {
		if p := r.getFromUPAKLoader(m, tmp); p != nil {
			trace += "l"
			r.putToMemCache(m, ck, *p)
			return *p
		}
	}

	trace += "s"
	res = r.resolveURLViaServerLookup(m, au, input, withBody)

	// Cache for a shorter period of time if it's not a Keybase identity
	res.mutable = isMutable(au)
	r.putToMemCache(m, ck, res)

	// We only put to disk cache if it's a Keybase-type assertion. In
	// particular, UIDs are **not** stored to disk.
	if au.IsKeybase() {
		trace += "p"
		r.putToDiskCache(m, ck, res)
	}

	return res
}

func (res *ResolveResult) decorate(au AssertionURL) {
	if au.IsKeybase() {
		res.queriedKbUsername = au.GetValue()
	} else if au.IsUID() {
		res.queriedByUID = true
	}
}

func (r *ResolverImpl) resolveURLViaServerLookup(m MetaContext, au AssertionURL, input string, withBody bool) (res ResolveResult) {
	defer m.CVTrace(VLog1, fmt.Sprintf("Resolver#resolveURLViaServerLookup(input = %q)", input), func() error { return res.err })()

	if au.IsTeamID() || au.IsTeamName() {
		return r.resolveTeamViaServerLookup(m, au)
	}

	if au.IsServerTrust() {
		return r.resolveServerTrustAssertion(m, au, input)
	}

	var key, val string
	var ares *APIRes
	var l int

	res.decorate(au)

	if key, val, res.err = au.ToLookup(); res.err != nil {
		return
	}

	ha := HTTPArgsFromKeyValuePair(key, S{val})
	ha.Add("multi", I{1})
	ha.Add("load_deleted_v2", B{true})
	fields := "basics"
	if withBody {
		fields += ",public_keys,pictures"
	}
	ha.Add("fields", S{fields})
	ares, res.err = m.G().API.Get(APIArg{
		Endpoint:        "user/lookup",
		SessionType:     APISessionTypeNONE,
		Args:            ha,
		AppStatusCodes:  []int{SCOk, SCNotFound, SCDeleted},
		MetaContext:     m,
		RetryCount:      3,
		InitialTimeout:  4 * time.Second,
		RetryMultiplier: 1.5,
	})

	if res.err != nil {
		m.CDebugf("API user/lookup %q error: %s", input, res.err)
		return
	}
	switch ares.AppStatus.Code {
	case SCNotFound:
		m.CDebugf("API user/lookup %q not found", input)
		res.err = NotFoundError{}
		return
	}

	var them *jsonw.Wrapper
	if them, res.err = ares.Body.AtKey("them").ToArray(); res.err != nil {
		return res
	}

	if l, res.err = them.Len(); res.err != nil {
		return res
	}

	if l == 0 {
		res.err = ResolutionError{Input: input, Msg: "No resolution found", Kind: ResolutionErrorNotFound}
		return res
	}
	if l > 1 {
		res.err = ResolutionError{Input: input, Msg: "Identify is ambiguous", Kind: ResolutionErrorAmbiguous}
		return res
	}
	res.body = them.AtIndex(0)
	res.uid, res.err = GetUID(res.body.AtKey("id"))
	if res.err != nil {
		return res
	}
	res.resolvedKbUsername, res.err = res.body.AtPath("basics.username").GetString()
	if res.err != nil {
		return res
	}
	var status int
	status, res.err = res.body.AtPath("basics.status").GetInt()
	if res.err != nil {
		return res
	}
	if status == SCDeleted {
		res.deleted = true
	}

	return res
}

type teamLookup struct {
	ID     keybase1.TeamID   `json:"id"`
	Name   keybase1.TeamName `json:"name"`
	Status AppStatus         `json:"status"`
}

func (t *teamLookup) GetAppStatus() *AppStatus {
	return &t.Status
}

func (r *ResolverImpl) resolveTeamViaServerLookup(m MetaContext, au AssertionURL) (res ResolveResult) {
	m.CDebugf("resolveTeamViaServerLookup")

	res.queriedByTeamID = au.IsTeamID()
	key, val, err := au.ToLookup()
	if err != nil {
		res.err = err
		return res
	}

	arg := NewAPIArgWithMetaContext(m, "team/get")
	arg.SessionType = APISessionTypeREQUIRED
	arg.Args = make(HTTPArgs)
	arg.Args[key] = S{Val: val}
	arg.Args["lookup_only"] = B{Val: true}
	if res.queriedByTeamID && au.ToTeamID().IsPublic() {
		arg.Args["public"] = B{Val: true}
	}

	var lookup teamLookup
	if err := m.G().API.GetDecode(arg, &lookup); err != nil {
		res.err = err
		return res
	}

	res.resolvedTeamName = lookup.Name
	res.teamID = lookup.ID

	return res
}

type serverTrustUserLookup struct {
	AppStatusEmbed
	User *keybase1.PhoneLookupResult `json:"user"`
}

func (r *ResolverImpl) resolveServerTrustAssertion(m MetaContext, au AssertionURL, input string) (res ResolveResult) {
	defer m.CTrace(fmt.Sprintf("Resolver#resolveServerTrustAssertion(%q, %q)", au.String(), input), func() error { return res.err })()

	enabled := m.G().FeatureFlags.Enabled(m, FeatureIMPTOFU)
	if enabled {
		m.CDebugf("Resolver: phone number and email proofs enabled")
	} else {
		m.CDebugf("Resolver: phone number and email proofs disabled")
		res.err = ResolutionError{Input: input, Msg: "Proof type disabled.", Kind: ResolutionErrorInvalidInput}
		return res
	}

	key, val, err := au.ToLookup()
	if err != nil {
		res.err = err
		return res
	}

	var arg APIArg
	switch key {
	case "phone":
		arg = NewAPIArgWithMetaContext(m, "user/phone_numbers_search")
		arg.Args = map[string]HTTPValue{"phone_number": S{Val: val}}
	case "email":
		arg = NewAPIArgWithMetaContext(m, "email/search")
		arg.Args = map[string]HTTPValue{"email": S{Val: val}}
	default:
		res.err = ResolutionError{Input: input, Msg: fmt.Sprintf("Unexpected assertion: %q for server trust lookup", key), Kind: ResolutionErrorInvalidInput}
		return res
	}

	arg.SessionType = APISessionTypeREQUIRED
	arg.AppStatusCodes = []int{SCOk}

	var lookup serverTrustUserLookup
	if err := m.G().API.GetDecode(arg, &lookup); err != nil {
		if appErr, ok := err.(AppStatusError); ok {
			switch appErr.Code {
			case SCInputError:
				res.err = ResolutionError{Input: input, Msg: err.Error(), Kind: ResolutionErrorInvalidInput}
				return res
			case SCRateLimit:
				res.err = ResolutionError{Input: input, Msg: err.Error(), Kind: ResolutionErrorRateLimited}
				return res
			}
		}
		// When the call fails because of timeout or other reason, stop
		// the process as well. Same reason as other errors - we don't
		// want to create dead SBS team when there was a resolvable user
		// but we weren't able to resolve.
		res.err = ResolutionError{Input: input, Msg: err.Error(), Kind: ResolutionErrorRequestFailed}
		return res
	}

	if lookup.User == nil {
		res.err = ResolutionError{Input: input, Msg: "No resolution found", Kind: ResolutionErrorNotFound}
		return res
	}

	user := *lookup.User
	res.resolvedKbUsername = user.Username
	res.uid = user.Uid
	res.isServerTrust = true
	// Mutable resolutions are not cached to disk. We can't be aggressive when
	// caching server-trust resolutions, because when client pulls out one from
	// cache, they have no way to verify it's still valid. From the server-side
	// we have no way to invalidate that cache.
	res.mutable = true

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

type ResolverImpl struct {
	cache   *ramcache.Ramcache
	Stats   ResolveCacheStats
	locktab LockTable
}

func (s ResolveCacheStats) Eq(m, t, mt, et, h int) bool {
	return (s.misses == m) && (s.timeouts == t) && (s.mutableTimeouts == mt) && (s.errorTimeouts == et) && (s.hits == h)
}

func (s ResolveCacheStats) EqWithDiskHits(m, t, mt, et, h, dh int) bool {
	return (s.misses == m) && (s.timeouts == t) && (s.mutableTimeouts == mt) && (s.errorTimeouts == et) && (s.hits == h) && (s.diskGetHits == dh)
}

func NewResolverImpl() *ResolverImpl {
	return &ResolverImpl{
		cache: nil,
	}
}

func (r *ResolverImpl) EnableCaching(m MetaContext) {
	cache := ramcache.New()
	cache.MaxAge = ResolveCacheMaxAge
	cache.TTL = resolveCacheTTL
	r.cache = cache
}

func (r *ResolverImpl) Shutdown(m MetaContext) {
	if r.cache == nil {
		return
	}
	r.cache.Shutdown()
}

func (r *ResolverImpl) getFromMemCache(m MetaContext, key string, au AssertionURL) (ret *ResolveResult) {
	defer m.CVTraceOK(VLog1, fmt.Sprintf("Resolver#getFromMemCache(%q)", key), func() bool { return ret != nil })()
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
	if !rres.HasPrimaryKey() {
		m.CInfof("Resolver#getFromMemCache: nil UID/teamID in cache")
		return nil
	}
	now := m.G().Clock().Now()
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

func (r *ResolverImpl) putToDiskCache(m MetaContext, key string, res ResolveResult) {
	m.VLogf(VLog1, "| Resolver#putToDiskCache (attempt) %+v", res)
	// Only cache immutable resolutions to disk
	if res.mutable {
		return
	}
	// Don't cache errors or deleted users
	if res.err != nil || res.deleted {
		return
	}
	if res.uid.IsNil() {
		m.CWarningf("Mistaken UID put to disk cache")
		if m.G().Env.GetDebug() {
			debug.PrintStack()
		}
		return
	}
	r.Stats.diskPuts++
	if err := m.G().LocalDb.PutObj(resolveDbKey(key), nil, res.uid); err != nil {
		m.CWarningf("Cannot put resolve result to disk: %s", err)
		return
	}
	m.CDebugf("| Resolver#putToDiskCache(%s) -> %v", key, res)
}

// Put receives a copy of a ResolveResult, clears out the body
// to avoid caching data that can go stale, and stores the result.
func (r *ResolverImpl) putToMemCache(m MetaContext, key string, res ResolveResult) {
	if r.cache == nil {
		return
	}
	// Don't cache errors or deleted users
	if res.err != nil || res.deleted {
		return
	}
	if !res.HasPrimaryKey() {
		m.CWarningf("Mistaken UID put to mem cache")
		if m.G().Env.GetDebug() {
			debug.PrintStack()
		}
		return
	}
	res.cachedAt = m.G().Clock().Now()
	res.body = nil // Don't cache body
	r.cache.Set(key, &res)
}

func (r *ResolverImpl) CacheTeamResolution(m MetaContext, id keybase1.TeamID, name keybase1.TeamName) {
	m.VLogf(VLog0, "ResolverImpl#CacheTeamResolution: %s <-> %s", id, name)
	res := ResolveResult{
		teamID:           id,
		queriedByTeamID:  true,
		resolvedTeamName: name,
		mutable:          id.IsSubTeam(),
	}
	r.putToMemCache(m, fmt.Sprintf("tid:%s", id), res)
	res.queriedByTeamID = false
	r.putToMemCache(m, fmt.Sprintf("team:%s", name.String()), res)
}

func (r *ResolverImpl) PurgeResolveCache(m MetaContext, input string) (err error) {
	defer m.CTrace(fmt.Sprintf("Resolver#PurgeResolveCache(input = %q)", input), func() error { return err })()
	expr, err := AssertionParseAndOnly(m.G().MakeAssertionContext(), input)
	if err != nil {
		return err
	}
	u := FindBestIdentifyComponentURL(expr)
	if u == nil {
		return ResolutionError{Input: input, Msg: "Cannot find a resolvable factor"}
	}

	key := u.CacheKey()
	r.cache.Delete(key)
	// Since we only put to disk cache if it's a Keybase-type assertion, we
	// only remove it in this case as well.
	if u.IsKeybase() {
		if err := m.G().LocalDb.Delete(resolveDbKey(key)); err != nil {
			m.CWarningf("Cannot remove resolve result from disk: %s", err)
			return err
		}
	}
	return nil
}

var _ Resolver = (*ResolverImpl)(nil)
