// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package home

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type homeCache struct {
	obj      keybase1.HomeScreen
	cachedAt time.Time
}

type peopleCache struct {
	all       []keybase1.HomeUserSummary
	lastShown []keybase1.HomeUserSummary
	cachedAt  time.Time
}

type Home struct {
	libkb.Contextified

	sync.Mutex
	homeCache   *homeCache
	peopleCache *peopleCache
}

type rawGetHome struct {
	libkb.AppStatusEmbed
	Home keybase1.HomeScreen `json:"home"`
}

func NewHome(g *libkb.GlobalContext) *Home {
	home := &Home{Contextified: libkb.NewContextified(g)}
	g.AddLogoutHook(home, "home")
	g.AddDbNukeHook(home, "home")
	return home
}

func homeRetry(a libkb.APIArg) libkb.APIArg {
	a.RetryCount = 3
	a.InitialTimeout = 4 * time.Second
	a.RetryMultiplier = 1.1
	return a
}

func (h *Home) getToCache(ctx context.Context, markedViewed bool, numPeopleWanted int, skipPeople bool) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("Home#getToCache", func() error { return err })()

	numPeopleToRequest := 100
	if numPeopleWanted > numPeopleToRequest {
		numPeopleToRequest = numPeopleWanted
	}
	if skipPeople {
		numPeopleToRequest = 0
	}
	arg := libkb.NewAPIArg("home")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"record_visit": libkb.B{Val: markedViewed},
		"num_people":   libkb.I{Val: numPeopleToRequest},
	}
	var raw rawGetHome
	if err = mctx.G().API.GetDecode(mctx, homeRetry(arg), &raw); err != nil {
		return err
	}
	home := raw.Home

	newPeopleCache := &peopleCache{
		all: home.FollowSuggestions,
	}

	if h.peopleCache != nil {
		newPeopleCache.lastShown = h.peopleCache.lastShown
		newPeopleCache.cachedAt = h.peopleCache.cachedAt
	}
	h.peopleCache = newPeopleCache

	mctx.Debug("| %d follow suggestions returned", len(home.FollowSuggestions))
	home.FollowSuggestions = nil

	h.homeCache = &homeCache{
		obj:      home,
		cachedAt: h.G().GetClock().Now(),
	}

	return nil
}

func (h *Home) Get(ctx context.Context, markViewed bool, numPeopleWanted int) (ret keybase1.HomeScreen, err error) {
	defer h.G().CTraceTimed(ctx, "Home#Get", func() error { return err })()

	// 10 people by default
	if numPeopleWanted < 0 {
		numPeopleWanted = 10
	}

	h.Lock()
	defer h.Unlock()

	useCache, people := h.peopleCache.isValid(ctx, h.G(), numPeopleWanted)
	if useCache {
		useCache = h.homeCache.isValid(ctx, h.G())
	}

	if useCache && markViewed {
		err := h.bustHomeCacheIfBadgedFollowers(ctx)
		if err != nil {
			return ret, err
		}
		useCache = h.homeCache != nil
		// If we blew up our cache, get out of here and refetch, proceed with
		// marking the view.
		if useCache {
			h.G().Log.CDebugf(ctx, "| cache is good; going to server to mark view")
			if err := h.markViewedAPICall(ctx); err != nil {
				h.G().Log.CInfof(ctx, "Error marking home as viewed: %s", err.Error())
			}
		}
	}

	if !useCache {
		h.G().Log.CDebugf(ctx, "| cache is no good; going fetching from server")
		// If we've already found the people we need to show in the cache,
		// there's no reason to reload them.
		skipLoadPeople := len(people) > 0
		if err = h.getToCache(ctx, markViewed, numPeopleWanted, skipLoadPeople); err != nil {
			return ret, err
		}
	}

	// Prime the return object with whatever was cached for home
	tmp := h.homeCache.obj

	if people != nil {
		tmp.FollowSuggestions = people
	} else {
		err := h.peopleCache.loadInto(ctx, h.G(), &tmp, numPeopleWanted)
		if err != nil {
			return ret, err
		}
	}

	// Return a deep copy of the tmp object, so that the caller can't
	// change it or race against other Go routines.
	ret = tmp.DeepCopy()

	return ret, nil
}

func (p *peopleCache) loadInto(ctx context.Context, g *libkb.GlobalContext, out *keybase1.HomeScreen, numPeopleWanted int) error {
	if numPeopleWanted > len(p.all) {
		numPeopleWanted = len(p.all)
		g.Log.CDebugf(ctx, "| didn't get enough people loaded, so short-changing at %d", numPeopleWanted)
	}
	out.FollowSuggestions = p.all[0:numPeopleWanted]
	p.all = p.all[numPeopleWanted:]
	p.lastShown = out.FollowSuggestions
	p.cachedAt = g.GetClock().Now()
	return nil
}

func (h *homeCache) isValid(ctx context.Context, g *libkb.GlobalContext) bool {
	if h == nil {
		g.Log.CDebugf(ctx, "| homeCache == nil, therefore isn't valid")
		return false
	}
	diff := g.GetClock().Now().Sub(h.cachedAt)
	if diff >= libkb.HomeCacheTimeout {
		g.Log.CDebugf(ctx, "| homeCache was stale (cached %s ago)", diff)
		return false
	}
	g.Log.CDebugf(ctx, "| homeCache was valid (cached %s ago)", diff)
	return true
}

func (p *peopleCache) isValid(ctx context.Context, g *libkb.GlobalContext, numPeopleWanted int) (bool, []keybase1.HomeUserSummary) {
	if p == nil {
		g.Log.CDebugf(ctx, "| peopleCache = nil, therefore isn't valid")
		return false, nil
	}
	diff := g.GetClock().Now().Sub(p.cachedAt)
	if diff < libkb.HomePeopleCacheTimeout && numPeopleWanted <= len(p.lastShown) {
		g.Log.CDebugf(ctx, "| peopleCache is valid, just returning last viewed")
		return true, p.lastShown
	}
	if numPeopleWanted <= len(p.all) {
		g.Log.CDebugf(ctx, "| people cache is valid, can pop from all")
		return true, nil
	}
	return false, nil
}

func (h *Home) skipTodoType(ctx context.Context, typ keybase1.HomeScreenTodoType) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("Home#skipTodoType", func() error { return err })()

	_, err = mctx.G().API.Post(mctx, homeRetry(libkb.APIArg{
		Endpoint:    "home/todo/skip",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"type": libkb.I{Val: int(typ)},
		},
	}))

	return err
}

func (h *Home) DismissAnnouncement(ctx context.Context, id keybase1.HomeScreenAnnouncementID) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("Home#DismissAnnouncement", func() error { return err })()

	_, err = mctx.G().API.Post(mctx, homeRetry(libkb.APIArg{
		Endpoint:    "home/todo/skip",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"announcement": libkb.I{Val: int(id)},
		},
	}))

	return err
}

func (h *Home) bustCache(ctx context.Context, bustPeople bool) {
	h.G().Log.CDebugf(ctx, "Home#bustCache")
	h.Lock()
	defer h.Unlock()
	h.homeCache = nil
	if bustPeople {
		h.peopleCache = nil
	}
}

func (h *Home) bustHomeCacheIfBadgedFollowers(ctx context.Context) (err error) {
	defer h.G().CTraceTimed(ctx, "+ Home#bustHomeCacheIfBadgedFollowers", func() error { return err })()

	if h.homeCache == nil {
		h.G().Log.CDebugf(ctx, "| nil home cache, nothing to bust")
		return nil
	}

	bust := false
	for i, item := range h.homeCache.obj.Items {
		if !item.Badged {
			continue
		}
		if typ, err := item.Data.T(); err != nil {
			bust = true
			h.G().Log.CDebugf(ctx, "| in bustHomeCacheIfBadgedFollowers: bad item: %v", err)
			break
		} else if typ == keybase1.HomeScreenItemType_PEOPLE {
			bust = true
			h.G().Log.CDebugf(ctx, "| in bustHomeCacheIfBadgedFollowers: found badged home people item @%d", i)
			break
		}
	}

	if bust {
		h.G().Log.CDebugf(ctx, "| busting home cache")
		h.homeCache = nil
	} else {
		h.G().Log.CDebugf(ctx, "| not busting home cache")
	}

	return nil
}

func (h *Home) SkipTodoType(ctx context.Context, typ keybase1.HomeScreenTodoType) (err error) {
	var which string
	var ok bool
	if which, ok = keybase1.HomeScreenTodoTypeRevMap[typ]; !ok {
		which = fmt.Sprintf("unknown=%d", int(typ))
	}
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("home#SkipTodoType(%s)", which), func() error { return err })()
	h.bustCache(ctx, false)
	return h.skipTodoType(ctx, typ)
}

func (h *Home) MarkViewed(ctx context.Context) (err error) {
	defer h.G().CTraceTimed(ctx, "Home#MarkViewed", func() error { return err })()
	h.Lock()
	defer h.Unlock()
	return h.markViewedWithLock(ctx)
}

func (h *Home) markViewedWithLock(ctx context.Context) (err error) {
	defer h.G().CTraceTimed(ctx, "Home#markViewedWithLock", func() error { return err })()
	err = h.bustHomeCacheIfBadgedFollowers(ctx)
	if err != nil {
		return err
	}
	return h.markViewedAPICall(ctx)
}

func (h *Home) markViewedAPICall(ctx context.Context) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("Home#markViewedAPICall", func() error { return err })()

	if _, err = mctx.G().API.Post(mctx, homeRetry(libkb.APIArg{
		Endpoint:    "home/visit",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{},
	})); err != nil {
		mctx.Warning("Unable to home#markViewedAPICall: %v", err)
	}
	return nil
}

func (h *Home) ActionTaken(ctx context.Context) (err error) {
	defer h.G().CTraceTimed(ctx, "Home#ActionTaken", func() error { return err })()
	h.bustCache(ctx, false)
	return err
}

func (h *Home) OnLogout(m libkb.MetaContext) error {
	h.bustCache(m.Ctx(), true)
	return nil
}

func (h *Home) OnDbNuke(m libkb.MetaContext) error {
	h.bustCache(m.Ctx(), true)
	return nil
}

type updateGregorMessage struct {
	Version              int `json:"version"`
	AnnouncementsVersion int `json:"announcements_version"`
}

func (h *Home) updateUI(ctx context.Context) (err error) {
	defer h.G().CTraceTimed(ctx, "Home#updateUI", func() error { return err })()
	var ui keybase1.HomeUIInterface
	if h.G().UIRouter == nil {
		h.G().Log.CDebugf(ctx, "no UI router, swallowing update")
		return nil
	}
	ui, err = h.G().UIRouter.GetHomeUI()
	if err != nil {
		return err
	}
	if ui == nil {
		h.G().Log.CDebugf(ctx, "no registered HomeUI, swallowing update")
		return nil
	}
	err = ui.HomeUIRefresh(context.Background())
	return err
}

func (h *Home) handleUpdate(ctx context.Context, item gregor.Item) (err error) {
	defer h.G().CTraceTimed(ctx, "Home#handleUpdate", func() error { return err })()
	var msg updateGregorMessage
	if err = json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		h.G().Log.Debug("error unmarshaling home.update item: %s", err.Error())
		return err
	}

	h.G().Log.CDebugf(ctx, "home.update unmarshaled: %+v", msg)

	h.Lock()
	defer h.Unlock()

	if h.homeCache != nil {
		h.G().Log.CDebugf(ctx, "home.update state: (version=%d,announcementsVersion=%d)", h.homeCache.obj.Version, h.homeCache.obj.AnnouncementsVersion)
		if msg.Version > h.homeCache.obj.Version || msg.AnnouncementsVersion > h.homeCache.obj.AnnouncementsVersion {
			h.G().Log.CDebugf(ctx, "home.update: clearing cache")
			h.homeCache = nil
		}
	}

	// Ignore the error code...
	_ = h.updateUI(ctx)
	return nil
}

func (h *Home) IsAlive() bool {
	return true
}

func (h *Home) Name() string {
	return "Home"
}

func (h *Home) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, ibm gregor.Item) (bool, error) {
	switch category {
	case "home.update":
		return true, h.handleUpdate(ctx, ibm)
	default:
		if strings.HasPrefix(category, "home.") {
			return false, fmt.Errorf("unknown home handler category: %q", category)
		}
		return false, nil
	}
}

func (h *Home) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, ibm gregor.Item) (bool, error) {
	return true, nil
}

type rawPollHome struct {
	Status       libkb.AppStatus `json:"status"`
	NextPollSecs int             `json:"next_poll_secs"`
}

func (r *rawPollHome) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func (h *Home) RunUpdateLoop(m libkb.MetaContext) {
	go h.updateLoopThread(m)
}

func (h *Home) updateLoopThread(m libkb.MetaContext) {
	m = m.WithLogTag("HULT")
	m.Debug("Starting Home#updateLoopThread")
	slp := time.Minute * (time.Duration(5) + time.Duration((rand.Int() % 10)))
	var err error
	for {
		m.Debug("Sleeping %v until next poll", slp)
		m.G().Clock().Sleep(slp)
		slp, err = h.pollOnce(m)
		if _, ok := err.(libkb.DeviceRequiredError); ok {
			slp = time.Duration(1) * time.Minute
		} else if err != nil {
			slp = time.Duration(15) * time.Minute
			m.Debug("Hit an error in home update loop: %v", err)
		}
	}
}

func (h *Home) pollOnce(m libkb.MetaContext) (d time.Duration, err error) {
	defer m.TraceTimed("Home#pollOnce", func() error { return err })()

	if !m.HasAnySession() {
		m.Debug("No-op, since don't have keys (and/or am not logged in)")
		return time.Duration(0), libkb.DeviceRequiredError{}
	}

	var raw rawPollHome
	err = m.G().API.GetDecode(m, libkb.APIArg{
		Endpoint:    "home/poll",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{},
	}, &raw)
	if err != nil {
		m.Warning("Unable to Home#pollOnce: %v", err)
		return time.Duration(0), err
	}
	return time.Duration(raw.NextPollSecs) * time.Second, nil
}
