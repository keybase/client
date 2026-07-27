package teams

import (
	"context"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// annotatedTeamCacheTTL bounds how stale a memoized AnnotatedTeam can be when no
// invalidating event arrives. Every local mutation and every server-pushed team
// change purges the entry (see NotifyRouter.HandleTeamChangedByID and
// invalidateCaches), so this window covers what those do not tell us about:
// member resets and deletions, username and full-name changes, and off-chain
// changes made elsewhere. Those come from the UIDMapper and produce no team
// sigchain change, so nothing invalidates on them.
const annotatedTeamCacheTTL = 10 * time.Second

// minAnnotatedTeamCacheLifetime is how long an entry is guaranteed to be usable
// no matter how slow the load that produced it was. Entries age from when their
// load started, and a load can take longer than the whole TTL -- GetAnnotatedTeam
// fans out to several round trips, one of which budgets 10s by itself. Without a
// floor those loads are cached already expired, so every waiter wakes to a miss
// and reloads: the teams that most need memoizing would get none, and the cache
// would amplify their cost instead.
const minAnnotatedTeamCacheLifetime = annotatedTeamCacheTTL / 2

// maxAnnotatedTeamCacheWaits caps how many times a caller will wait on somebody
// else's in-flight load before doing the load itself, so a pathological stream of
// invalidations cannot livelock a request.
const maxAnnotatedTeamCacheWaits = 3

// annotatedTeamCacheSize bounds resident entries. An AnnotatedTeam carries the
// full member, invite and join-request lists, and entries are only dropped when
// that same team is read again, so an unbounded map retains one per team ever
// visited for the whole session.
const annotatedTeamCacheSize = 50

type annotatedTeamCacheEntry struct {
	team     keybase1.AnnotatedTeam
	cachedAt time.Time
}

// annotatedTeamCache memoizes GetAnnotatedTeam. GetAnnotatedTeam is expensive: a
// force-repolled team load plus four separate server round trips (team/for_user,
// team/get?showcase_only, team/access_requests, team/disable_tars), and the UI asks
// for the same team many times while a team page is open. This cache both collapses
// concurrent identical loads into one (single-flight) and serves a short-lived
// memoized copy to sequential callers.
type annotatedTeamCache struct {
	sync.Mutex
	entries *lru.Cache
	// inflight[teamID] is closed when the current load for teamID finishes.
	inflight map[keybase1.TeamID]chan struct{}
	// gen[teamID] is bumped by Remove. A load that started before a bump does not
	// get cached, since it may have read pre-change data.
	gen map[keybase1.TeamID]uint64
	// epoch is bumped by Clear, which has no team to key on. Per-team gens cannot
	// carry it: Clear can only walk the teams it can see, and a load whose team is
	// in neither entries nor inflight -- one running alongside a leader that has
	// already finished and errored -- would be missed and cache the old account's
	// data. AnnotatedTeam is viewer-specific, so that matters.
	epoch uint64
}

var _ libkb.AnnotatedTeamCacher = (*annotatedTeamCache)(nil)

func newAnnotatedTeamCache() *annotatedTeamCache {
	entries, err := lru.New(annotatedTeamCacheSize)
	if err != nil {
		// only returned for a non-positive size, which is a constant here
		panic(err)
	}
	return &annotatedTeamCache{
		entries:  entries,
		inflight: make(map[keybase1.TeamID]chan struct{}),
		gen:      make(map[keybase1.TeamID]uint64),
	}
}

func (c *annotatedTeamCache) Get(mctx libkb.MetaContext, teamID keybase1.TeamID) (res keybase1.AnnotatedTeam, ok bool) {
	c.Lock()
	defer c.Unlock()
	return c.getLocked(mctx, teamID)
}

func (c *annotatedTeamCache) getLocked(mctx libkb.MetaContext, teamID keybase1.TeamID) (res keybase1.AnnotatedTeam, ok bool) {
	tmp, ok := c.entries.Get(teamID)
	if !ok {
		return res, false
	}
	e, ok := tmp.(annotatedTeamCacheEntry)
	if !ok {
		c.entries.Remove(teamID)
		return res, false
	}
	if mctx.G().Clock().Now().Sub(e.cachedAt) >= annotatedTeamCacheTTL {
		c.entries.Remove(teamID)
		return res, false
	}
	return e.team, true
}

func (c *annotatedTeamCache) Remove(teamID keybase1.TeamID) {
	c.Lock()
	defer c.Unlock()
	c.entries.Remove(teamID)
	c.gen[teamID]++
}

func (c *annotatedTeamCache) Clear() {
	c.Lock()
	defer c.Unlock()
	c.epoch++
	c.entries.Purge()
	// gen only matters for loads that are still running, and the epoch bump above
	// already invalidates every one of those. Dropping it here keeps the map from
	// growing by one entry per team ever invalidated, for the life of the process.
	c.gen = make(map[keybase1.TeamID]uint64)
}

func (c *annotatedTeamCache) OnLogout(mctx libkb.MetaContext) error {
	c.Clear()
	return nil
}

func (c *annotatedTeamCache) OnDbNuke(mctx libkb.MetaContext) error {
	c.Clear()
	return nil
}

type annotatedTeamLoader func(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (keybase1.AnnotatedTeam, error)

// load returns a memoized AnnotatedTeam if we have a fresh one, waits for an
// already-running load of the same team if there is one, and otherwise runs loader.
func (c *annotatedTeamCache) load(mctx libkb.MetaContext, teamID keybase1.TeamID, loader annotatedTeamLoader) (res keybase1.AnnotatedTeam, err error) {
	for waits := 0; ; waits++ {
		cached, hit, wait, lead, startedGen, startedEpoch := c.beginLoad(mctx, teamID, waits < maxAnnotatedTeamCacheWaits)
		switch {
		case hit:
			mctx.Debug("annotatedTeamCache: hit for %v", teamID)
			return cached, nil
		case wait != nil:
			mctx.Debug("annotatedTeamCache: waiting on in-flight load for %v", teamID)
			select {
			case <-wait:
				continue
			case <-mctx.Ctx().Done():
				return res, mctx.Ctx().Err()
			}
		}

		// The leader must release its slot even if loader panics: the RPC
		// handler recovers, but a populated inflight entry whose channel is
		// never closed would make every later load of this team block until its
		// ctx dies, for the life of the process. Deferred rather than inline for
		// that reason; this path always returns below, so despite the enclosing
		// loop it is registered at most once.
		if lead != nil {
			defer c.endLoad(teamID, lead)
		}

		// Age the entry from when the load started, not when it finished: the
		// data describes the server state as of the request, so a slow loader
		// must not buy the result extra TTL it has already spent being stale.
		// storeLoad applies the floor that keeps a very slow load from being
		// cached already expired.
		startedAt := mctx.G().Clock().Now()
		res, err = loader(mctx.Ctx(), mctx.G(), teamID)
		if err == nil {
			c.storeLoad(mctx, teamID, res, startedAt, startedGen, startedEpoch)
		}
		return res, err
	}
}

// beginLoad decides in one locked step what this caller does next: take a fresh
// cached team (hit), block on somebody else's load (wait), or run the load - as
// its leader if the slot was free (lead non-nil), otherwise alongside it.
// startedGen and startedEpoch pin the invalidation state the load reads at.
func (c *annotatedTeamCache) beginLoad(mctx libkb.MetaContext, teamID keybase1.TeamID, canWait bool) (
	cached keybase1.AnnotatedTeam, hit bool, wait, lead chan struct{}, startedGen, startedEpoch uint64,
) {
	c.Lock()
	defer c.Unlock()
	if cached, ok := c.getLocked(mctx, teamID); ok {
		return cached, true, nil, nil, 0, 0
	}
	if ch, ok := c.inflight[teamID]; ok {
		if canWait {
			return cached, false, ch, nil, 0, 0
		}
		// Somebody is loading, but this caller has waited its share, so it goes
		// ahead without claiming the slot.
		return cached, false, nil, nil, c.gen[teamID], c.epoch
	}
	ch := make(chan struct{})
	c.inflight[teamID] = ch
	return cached, false, nil, ch, c.gen[teamID], c.epoch
}

// endLoad releases the leader's slot and wakes everyone waiting on it.
func (c *annotatedTeamCache) endLoad(teamID keybase1.TeamID, lead chan struct{}) {
	c.Lock()
	delete(c.inflight, teamID)
	c.Unlock()
	close(lead)
}

// storeLoad memoizes a finished load, unless the team was invalidated while it
// ran - that result may have read pre-change data.
func (c *annotatedTeamCache) storeLoad(mctx libkb.MetaContext, teamID keybase1.TeamID,
	team keybase1.AnnotatedTeam, startedAt time.Time, startedGen, startedEpoch uint64,
) {
	c.Lock()
	defer c.Unlock()
	if c.gen[teamID] != startedGen || c.epoch != startedEpoch {
		return
	}
	// Two loads for the same team can run at once, because a caller that has used
	// up its waits proceeds alongside the leader. They can finish in either order,
	// so refuse to replace a newer result with an older one.
	if tmp, ok := c.entries.Get(teamID); ok {
		if e, ok := tmp.(annotatedTeamCacheEntry); ok && !startedAt.After(e.cachedAt) {
			return
		}
	}
	// A load slower than the TTL would otherwise be stored already expired, so
	// give every entry a minimum usable lifetime.
	if floor := mctx.G().Clock().Now().Add(-annotatedTeamCacheTTL + minAnnotatedTeamCacheLifetime); startedAt.Before(floor) {
		startedAt = floor
	}
	c.entries.Add(teamID, annotatedTeamCacheEntry{team: team, cachedAt: startedAt})
}

func NewAnnotatedTeamCacheAndInstall(g *libkb.GlobalContext) {
	cache := newAnnotatedTeamCache()
	g.SetAnnotatedTeamCacher(cache)
	g.AddLogoutHook(cache, "annotatedTeamCache")
	g.AddDbNukeHook(cache, "annotatedTeamCache")
}

// ClearAnnotatedTeamCache drops the memoized AnnotatedTeam for a team, forcing the
// next read to go to the server.
func ClearAnnotatedTeamCache(g *libkb.GlobalContext, teamID keybase1.TeamID) {
	if c := g.GetAnnotatedTeamCacher(); c != nil {
		c.Remove(teamID)
	}
}
