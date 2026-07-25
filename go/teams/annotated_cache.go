package teams

import (
	"context"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// annotatedTeamCacheTTL bounds how stale a memoized AnnotatedTeam can be when no
// invalidating event arrives. Every local mutation and every server-pushed team
// change purges the entry (see NotifyRouter.HandleTeamChangedByID and
// invalidateCaches), so this window only covers off-chain changes made elsewhere
// that we were not notified about.
const annotatedTeamCacheTTL = 10 * time.Second

// maxAnnotatedTeamCacheWaits caps how many times a caller will wait on somebody
// else's in-flight load before doing the load itself, so a pathological stream of
// invalidations cannot livelock a request.
const maxAnnotatedTeamCacheWaits = 3

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
	entries map[keybase1.TeamID]annotatedTeamCacheEntry
	// inflight[teamID] is closed when the current load for teamID finishes.
	inflight map[keybase1.TeamID]chan struct{}
	// gen[teamID] is bumped by Remove/Clear. A load that started before a bump does
	// not get cached, since it may have read pre-change data.
	gen map[keybase1.TeamID]uint64
}

var _ libkb.AnnotatedTeamCacher = (*annotatedTeamCache)(nil)

func newAnnotatedTeamCache() *annotatedTeamCache {
	return &annotatedTeamCache{
		entries:  make(map[keybase1.TeamID]annotatedTeamCacheEntry),
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
	e, ok := c.entries[teamID]
	if !ok {
		return res, false
	}
	if mctx.G().Clock().Now().Sub(e.cachedAt) >= annotatedTeamCacheTTL {
		delete(c.entries, teamID)
		return res, false
	}
	return e.team, true
}

func (c *annotatedTeamCache) Put(mctx libkb.MetaContext, teamID keybase1.TeamID, team keybase1.AnnotatedTeam) {
	c.Lock()
	defer c.Unlock()
	c.entries[teamID] = annotatedTeamCacheEntry{team: team, cachedAt: mctx.G().Clock().Now()}
}

func (c *annotatedTeamCache) Remove(teamID keybase1.TeamID) {
	c.Lock()
	defer c.Unlock()
	delete(c.entries, teamID)
	c.gen[teamID]++
}

func (c *annotatedTeamCache) Clear() {
	c.Lock()
	defer c.Unlock()
	for teamID := range c.entries {
		c.gen[teamID]++
	}
	for teamID := range c.inflight {
		c.gen[teamID]++
	}
	c.entries = make(map[keybase1.TeamID]annotatedTeamCacheEntry)
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
		c.Lock()
		if cached, ok := c.getLocked(mctx, teamID); ok {
			c.Unlock()
			mctx.Debug("annotatedTeamCache: hit for %v", teamID)
			return cached, nil
		}
		if ch, ok := c.inflight[teamID]; ok && waits < maxAnnotatedTeamCacheWaits {
			c.Unlock()
			mctx.Debug("annotatedTeamCache: waiting on in-flight load for %v", teamID)
			select {
			case <-ch:
				continue
			case <-mctx.Ctx().Done():
				return res, mctx.Ctx().Err()
			}
		}
		startedGen := c.gen[teamID]
		ch := make(chan struct{})
		hasLead := false
		if _, ok := c.inflight[teamID]; !ok {
			c.inflight[teamID] = ch
			hasLead = true
		}
		c.Unlock()

		startedAt := mctx.G().Clock().Now()
		res, err = loader(mctx.Ctx(), mctx.G(), teamID)

		c.Lock()
		if hasLead {
			delete(c.inflight, teamID)
		}
		if err == nil && c.gen[teamID] == startedGen {
			c.entries[teamID] = annotatedTeamCacheEntry{team: res, cachedAt: startedAt}
		}
		c.Unlock()
		if hasLead {
			close(ch)
		}
		return res, err
	}
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
