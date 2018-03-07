package home

import (
	"encoding/json"
	"fmt"
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
	Status libkb.AppStatus     `json:"status"`
	Home   keybase1.HomeScreen `json:"home"`
}

func (r *rawGetHome) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func NewHome(g *libkb.GlobalContext) *Home {
	home := &Home{Contextified: libkb.NewContextified(g)}
	g.AddLogoutHook(home)
	return home
}

func (h *Home) getToCache(ctx context.Context, markedViewed bool, numPeopleWanted int, skipPeople bool) (err error) {
	defer h.G().CTrace(ctx, "Home#get", func() error { return err })()

	numPeopleToRequest := 100
	if numPeopleWanted > numPeopleToRequest {
		numPeopleToRequest = numPeopleWanted
	}
	if skipPeople {
		numPeopleToRequest = 0
	}
	arg := libkb.NewAPIArgWithNetContext(ctx, "home")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"record_visit": libkb.B{Val: markedViewed},
		"num_people":   libkb.I{Val: numPeopleToRequest},
	}
	var raw rawGetHome
	if err = h.G().API.GetDecode(arg, &raw); err != nil {
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

	h.G().Log.CDebugf(ctx, "| %d follow suggestions returned", len(home.FollowSuggestions))
	home.FollowSuggestions = nil

	h.homeCache = &homeCache{
		obj:      home,
		cachedAt: h.G().GetClock().Now(),
	}

	return nil
}

func (h *Home) Get(ctx context.Context, markViewed bool, numPeopleWanted int) (ret keybase1.HomeScreen, err error) {
	defer h.G().CTrace(ctx, "Home#Get", func() error { return err })()

	// 10 people by default
	if numPeopleWanted < 0 {
		numPeopleWanted = 10
	}

	h.Lock()
	defer h.Unlock()

	inCache, people := h.peopleCache.isValid(ctx, h.G(), numPeopleWanted)
	if inCache {
		inCache = h.homeCache.isValid(ctx, h.G())
	}

	if inCache {
		h.G().Log.CDebugf(ctx, "| cache is good; skipping get")
		if markViewed {
			h.G().Log.CDebugf(ctx, "| going to server to mark view, anyways")
			tmpErr := h.markViewedWithLock(ctx)
			if tmpErr != nil {
				h.G().Log.CInfof(ctx, "Error marking home as viewed: %s", tmpErr.Error())
			}
		}
	} else {
		// If we've already found the people we need to show in the cache,
		// there's no reason to reload them.
		skipLoadPeople := len(people) > 0
		err = h.getToCache(ctx, markViewed, numPeopleWanted, skipLoadPeople)
		if err != nil {
			return ret, err
		}
	}

	// Prime the return object with whatever was cached for home
	tmp := h.homeCache.obj

	if people != nil {
		tmp.FollowSuggestions = people
	} else {
		h.peopleCache.loadInto(ctx, h.G(), &tmp, numPeopleWanted)
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
	defer h.G().CTrace(ctx, "Home#SkipType", func() error { return err })()

	_, err = h.G().API.Post(libkb.APIArg{
		Endpoint:    "home/todo/skip",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"type": libkb.I{Val: int(typ)},
		},
		NetContext: ctx,
	})

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

	defer h.G().CTrace(ctx, "+ Home#bustHomeCacheIfBadgedFollowers", func() error { return err })()

	if h.homeCache == nil {
		h.G().Log.CDebugf(ctx, "| nil home cache, nothing to bust")
		return nil
	}

	bust := false
	for i, item := range h.homeCache.obj.Items {
		if !item.Badged {
			continue
		}
		typ, err := item.Data.T()
		if err != nil {
			bust = true
			h.G().Log.CDebugf(ctx, "| in bustHomeCacheIfBadgedFollowers: bad item: %v", err)
			break
		}
		if typ == keybase1.HomeScreenItemType_PEOPLE {
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
	defer h.G().CTrace(ctx, fmt.Sprintf("home#SkipTodoType(%s)", which), func() error { return err })()
	h.bustCache(ctx, false)
	return h.skipTodoType(ctx, typ)
}

func (h *Home) MarkViewed(ctx context.Context) (err error) {
	defer h.G().CTrace(ctx, "Home#MarkViewed", func() error { return err })()
	h.Lock()
	defer h.Unlock()
	return h.markViewedWithLock(ctx)
}

func (h *Home) markViewedWithLock(ctx context.Context) (err error) {
	defer h.G().CTrace(ctx, "Home#markViewedWithLock", func() error { return err })()
	h.bustHomeCacheIfBadgedFollowers(ctx)
	return h.markViewedAPICall(ctx)
}

func (h *Home) markViewedAPICall(ctx context.Context) (err error) {
	defer h.G().CTrace(ctx, "Home#markViewedAPICall", func() error { return err })()

	_, err = h.G().API.Post(libkb.APIArg{
		Endpoint:    "home/visit",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{},
		NetContext:  ctx,
	})
	return err
}

func (h *Home) ActionTaken(ctx context.Context) (err error) {
	defer h.G().CTrace(ctx, "Home#ActionTaken", func() error { return err })()
	h.bustCache(ctx, false)
	return err
}

func (h *Home) OnLogout() error {
	h.bustCache(context.Background(), true)
	return nil
}

type updateGregorMessage struct {
	Version int `json:"version"`
}

func (h *Home) updateUI(ctx context.Context) (err error) {
	defer h.G().CTrace(ctx, "Home#updateUI", func() error { return err })()
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
	defer h.G().CTrace(ctx, "Home#handleUpdate", func() error { return err })()
	var msg updateGregorMessage
	if err = json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		h.G().Log.Debug("error unmarshaling home.update item: %s", err.Error())
		return err
	}
	h.G().Log.Debug("home.update unmarshaled: %+v", msg)

	h.Lock()
	defer h.Unlock()
	if h.homeCache != nil && msg.Version > h.homeCache.obj.Version {
		h.homeCache = nil
	}

	// Ignore the error code...
	h.updateUI(ctx)
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
		return false, fmt.Errorf("unknown home handler category: %q", category)
	}
}
func (h *Home) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, ibm gregor.Item) (bool, error) {
	return true, nil
}
