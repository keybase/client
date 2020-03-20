package libkb

import (
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
	"golang.org/x/time/rate"
)

type TeamMemberCountCache struct {
	g        *GlobalContext
	notifyCh chan struct{}

	lock  sync.RWMutex
	cache map[keybase1.TeamID]int
}

func newTeamMemberCountCache(g *GlobalContext) *TeamMemberCountCache {
	cache := &TeamMemberCountCache{
		cache:    make(map[keybase1.TeamID]int),
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
			c.g.NotifyRouter.HandleTeamMetadataUpdate(ctx)
			cancel()
		case <-ctx.Done():
			return
		}
	}
}

func (c *TeamMemberCountCache) Set(teamID keybase1.TeamID, count int) {
	c.lock.Lock()
	defer c.lock.Unlock()
	if c, ok := c.cache[teamID]; ok && c == count {
		return
	}
	c.cache[teamID] = count
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
