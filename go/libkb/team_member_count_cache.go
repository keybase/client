package libkb

import (
	"context"
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/time/rate"
)

type TeamMemberCountCache struct {
	g        *GlobalContext
	notifyCh chan struct{}

	lock  sync.RWMutex
	cache map[keybase1.TeamID]int
	// teams whose count changed since the notify loop last sent
	pending map[keybase1.TeamID]struct{}
}

func newTeamMemberCountCache(g *GlobalContext) *TeamMemberCountCache {
	cache := &TeamMemberCountCache{
		cache:    make(map[keybase1.TeamID]int),
		pending:  make(map[keybase1.TeamID]struct{}),
		g:        g,
		notifyCh: make(chan struct{}, 1),
	}
	cache.startNotifyLoop()
	g.AddLogoutHook(cache, "TeamMemberCountCache")
	return cache
}

func (c *TeamMemberCountCache) OnLogout(mctx MetaContext) error {
	mctx.Debug("TeamMemberCountCache OnLogout: clearing cache")
	c.lock.Lock()
	defer c.lock.Unlock()
	c.cache = make(map[keybase1.TeamID]int)
	c.pending = make(map[keybase1.TeamID]struct{})
	return nil
}

func (c *TeamMemberCountCache) startNotifyLoop() {
	ctx, cancel := context.WithCancel(context.Background())
	c.g.PushShutdownHook(func(mctx MetaContext) error {
		mctx.Debug("TeamMemberCountCache shutdown")
		cancel()
		return nil
	})
	go c.notifyLoop(ctx)
}

// popPending takes one team off pending. The notify loop sends one team at a
// time so a logout (which clears pending) drops the sends still queued for the
// old user.
func (c *TeamMemberCountCache) popPending() (keybase1.TeamID, bool) {
	c.lock.Lock()
	defer c.lock.Unlock()
	for teamID := range c.pending {
		delete(c.pending, teamID)
		return teamID, true
	}
	return "", false
}

func (c *TeamMemberCountCache) notifyLoop(ctx context.Context) {
	const notifyInterval = 5 * time.Second
	const notifyTimeout = 10 * time.Second
	limiter := rate.NewLimiter(rate.Every(notifyInterval), 1)
	for {
		if err := limiter.Wait(ctx); err != nil {
			return
		}
		select {
		case <-c.notifyCh:
			ctx, cancel := context.WithTimeout(context.Background(), notifyTimeout)
			for teamID, ok := c.popPending(); ok; teamID, ok = c.popPending() {
				c.g.NotifyRouter.HandleTeamChanged(ctx, teamID, keybase1.TeamChangedKinds{MemberCount: true}, 0)
			}
			c.g.NotifyRouter.HandleTeamMetadataUpdate(ctx)
			cancel()
		case <-ctx.Done():
			return
		}
	}
}

// Set caches a team's member count. With notify, a new or changed count
// schedules a teamChanged (and a teamMetadataUpdate), because the teams list
// shows the cached count in place of the server's. A first insert counts as a
// change: the server's count can differ from the locally computed one.
func (c *TeamMemberCountCache) Set(teamID keybase1.TeamID, count int, notify bool) {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c, ok := c.cache[teamID]; ok && c == count {
		return
	}
	c.cache[teamID] = count
	if !notify {
		return
	}
	c.pending[teamID] = struct{}{}
	select {
	case c.notifyCh <- struct{}{}:
	default:
	}
}

func (c *TeamMemberCountCache) Get(teamID keybase1.TeamID) (count int, ok bool) {
	c.lock.RLock()
	defer c.lock.RUnlock()
	count, ok = c.cache[teamID]
	return count, ok
}

func (c *TeamMemberCountCache) GetWithFallback(teamID keybase1.TeamID, fallback int) (count int) {
	count, ok := c.Get(teamID)
	if ok {
		return count
	}
	return fallback
}
