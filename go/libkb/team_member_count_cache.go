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
	go cache.notifyLoop()
	return cache
}

func (c *TeamMemberCountCache) notifyLoop() {
	const notifyInterval = 5 * time.Second
	const notifyTimeout = 10 * time.Second
	limiter := rate.NewLimiter(rate.Every(notifyInterval), 1)
	for {
		// We don't have a timeout on the wait, so just ignore the error.
		_ = limiter.Wait(context.Background())
		<-c.notifyCh
		ctx, cancel := context.WithTimeout(context.Background(), notifyTimeout)
		c.g.NotifyRouter.HandleTeamMetadataUpdate(ctx)
		cancel()
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
