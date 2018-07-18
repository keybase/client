package avatars

import (
	"context"
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/lru"
	"github.com/keybase/client/go/protocol/keybase1"
)

type URLCachingSource struct {
	libkb.Contextified

	diskLRU        *lru.DiskLRU
	staleThreshold time.Duration
	simpleSource   *SimpleSource

	// testing only
	staleFetchCh chan struct{}
}

var _ Source = (*URLCachingSource)(nil)

func NewURLCachingSource(g *libkb.GlobalContext, staleThreshold time.Duration, size int) *URLCachingSource {
	return &URLCachingSource{
		Contextified:   libkb.NewContextified(g),
		diskLRU:        lru.NewDiskLRU("avatarurls", 1, size),
		staleThreshold: staleThreshold,
		simpleSource:   NewSimpleSource(g),
	}
}

func (c *URLCachingSource) StartBackgroundTasks() {
	go c.monitorAppState()
}

func (c *URLCachingSource) StopBackgroundTasks() {
	c.diskLRU.Flush(context.Background(), c.G())
}

func (c *URLCachingSource) debug(m libkb.MetaContext, msg string, args ...interface{}) {
	m.CDebugf("Avatars.URLCachingSource: %s", fmt.Sprintf(msg, args...))
}

func (c *URLCachingSource) avatarKey(name string, format keybase1.AvatarFormat) string {
	return fmt.Sprintf("%s:%s", name, format.String())
}

func (c *URLCachingSource) isStale(item lru.DiskLRUEntry) bool {
	return c.G().GetClock().Now().Sub(item.Ctime) > c.staleThreshold
}

func (c *URLCachingSource) monitorAppState() {
	m := libkb.NewMetaContextBackground(c.G())
	c.debug(m, "monitorAppState: starting up")
	state := keybase1.AppState_FOREGROUND
	for {
		state = <-c.G().AppState.NextUpdate(&state)
		switch state {
		case keybase1.AppState_BACKGROUND:
			c.debug(m, "monitorAppState: backgrounded")
			c.diskLRU.Flush(m.Ctx(), m.G())
		}
	}
}

func (c *URLCachingSource) specLoad(m libkb.MetaContext, names []string, formats []keybase1.AvatarFormat) (res avatarLoadSpec, err error) {
	for _, name := range names {
		for _, format := range formats {
			key := c.avatarKey(name, format)
			found, entry, err := c.diskLRU.Get(m.Ctx(), c.G(), key)
			if err != nil {
				return res, err
			}
			lp := avatarLoadPair{
				name:   name,
				format: format,
			}
			if found {
				lp.path = entry.Value.(string)
				if c.isStale(entry) {
					res.stales = append(res.stales, lp)
				} else {
					res.hits = append(res.hits, lp)
				}
			} else {
				res.misses = append(res.misses, lp)
			}
		}
	}
	return res, nil
}

func (c *URLCachingSource) mergeRes(res *keybase1.LoadAvatarsRes, m keybase1.LoadAvatarsRes) {
	for username, rec := range m.Picmap {
		for format, url := range rec {
			res.Picmap[username][format] = url
		}
	}
}

func (c *URLCachingSource) commitURLs(m libkb.MetaContext, res keybase1.LoadAvatarsRes) {
	for name, rec := range res.Picmap {
		for format, url := range rec {
			if _, err := c.diskLRU.Put(m.Ctx(), c.G(), c.avatarKey(name, format), url); err != nil {
				c.debug(m, "commitURLs: failed to save URL: url: %s err: %s", url, err)
			}
		}
	}
}

func (c *URLCachingSource) loadNames(m libkb.MetaContext, names []string, formats []keybase1.AvatarFormat,
	remoteFetch func(libkb.MetaContext, []string, []keybase1.AvatarFormat) (keybase1.LoadAvatarsRes, error)) (res keybase1.LoadAvatarsRes, err error) {
	loadSpec, err := c.specLoad(m, names, formats)
	if err != nil {
		return res, err
	}
	c.debug(m, "loadNames: hits: %d stales: %d misses: %d", len(loadSpec.hits), len(loadSpec.stales),
		len(loadSpec.misses))

	// Fill in the hits
	allocRes(&res, names)
	for _, hit := range loadSpec.hits {
		res.Picmap[hit.name][hit.format] = keybase1.MakeAvatarURL(hit.path)
	}
	// Fill in stales
	for _, stale := range loadSpec.stales {
		res.Picmap[stale.name][stale.format] = keybase1.MakeAvatarURL(stale.path)
	}

	// Go get the misses
	missNames, missFormats := loadSpec.missDetails()
	if len(missNames) > 0 {
		loadRes, err := remoteFetch(m, missNames, missFormats)
		if err == nil {
			c.commitURLs(m, loadRes)
			c.mergeRes(&res, loadRes)
		} else {
			c.debug(m, "loadNames: failed to load server miss reqs: %s", err)
		}
	}
	// Spawn off a goroutine to reload stales
	staleNames, staleFormats := loadSpec.staleDetails()
	if len(staleNames) > 0 {
		go func() {
			m = m.BackgroundWithLogTags()
			c.debug(m, "loadNames: spawning stale background load: names: %d",
				len(staleNames))
			loadRes, err := remoteFetch(m, staleNames, staleFormats)
			if err != nil {
				c.debug(m, "loadNames: failed to load server stale reqs: %s", err)
			} else {
				c.commitURLs(m, loadRes)
			}
			if c.staleFetchCh != nil {
				c.staleFetchCh <- struct{}{}
			}
		}()
	}
	return res, nil
}

func (c *URLCachingSource) clearName(m libkb.MetaContext, name string, formats []keybase1.AvatarFormat) (err error) {
	for _, format := range formats {
		key := c.avatarKey(name, format)
		if err := c.diskLRU.Remove(m.Ctx(), c.G(), key); err != nil {
			return err
		}
	}
	return nil
}

func (c *URLCachingSource) LoadUsers(m libkb.MetaContext, usernames []string, formats []keybase1.AvatarFormat) (res keybase1.LoadAvatarsRes, err error) {
	defer m.CTrace("URLCachingSource.LoadUsers", func() error { return err })()
	return c.loadNames(m, usernames, formats, c.simpleSource.LoadUsers)
}

func (c *URLCachingSource) LoadTeams(m libkb.MetaContext, teams []string, formats []keybase1.AvatarFormat) (res keybase1.LoadAvatarsRes, err error) {
	defer m.CTrace("URLCachingSource.LoadTeams", func() error { return err })()
	return c.loadNames(m, teams, formats, c.simpleSource.LoadTeams)
}

func (c *URLCachingSource) ClearCacheForName(m libkb.MetaContext, name string, formats []keybase1.AvatarFormat) (err error) {
	defer m.CTrace(fmt.Sprintf("URLCachingSource.ClearCacheForUser(%s,%v)", name, formats), func() error { return err })()
	return c.clearName(m, name, formats)
}

func (c *URLCachingSource) OnCacheCleared(m libkb.MetaContext) {}
