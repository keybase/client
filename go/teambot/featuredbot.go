package teambot

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams/opensearch"
)

const (
	refreshLifetime = 2 * time.Hour
	cacheLifetime   = 24 * time.Hour
)

type featuredBotsCache struct {
	Data  keybase1.FeaturedBotsRes `codec:"d" json:"d"`
	Ctime gregor1.Time             `codec:"c" json:"c"`
}

func (c featuredBotsCache) isFresh() bool {
	return time.Since(c.Ctime.Time()) <= cacheLifetime
}

type FeaturedBotLoader struct {
	libkb.Contextified
}

func NewFeaturedBotLoader(g *libkb.GlobalContext) *FeaturedBotLoader {
	return &FeaturedBotLoader{
		Contextified: libkb.NewContextified(g),
	}
}

func (l *FeaturedBotLoader) debug(mctx libkb.MetaContext, msg string, args ...interface{}) {
	l.G().Log.CDebugf(mctx.Ctx(), "FeaturedBotLoader: %s", fmt.Sprintf(msg, args...))
}

func (l *FeaturedBotLoader) SearchLocal(mctx libkb.MetaContext, arg keybase1.SearchLocalArg) (res keybase1.SearchRes, err error) {
	defer mctx.Trace("FeaturedBotLoader: SearchLocal", &err)()
	if arg.Limit == 0 {
		return res, nil
	}
	bots, err := l.AllFeaturedBots(mctx, arg.SkipCache)
	if err != nil {
		return res, err
	}

	var results []rankedSearchItem
	if len(arg.Query) == 0 {
		for _, bot := range bots.Bots {
			score := float64(bot.Rank)
			if !bot.IsPromoted || opensearch.FilterScore(score) {
				continue
			}
			results = append(results, rankedSearchItem{
				item:  bot,
				score: score,
			})
		}
	} else {
		query := strings.ToLower(arg.Query)
		for _, item := range bots.Bots {
			rankedItem := rankedSearchItem{
				item: item,
			}
			rankedItem.score = rankedItem.Score(query)
			if opensearch.FilterScore(rankedItem.score) {
				continue
			}
			results = append(results, rankedItem)
		}
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].score > results[j].score
	})
	res.IsLastPage = true
	for index, r := range results {
		if index >= arg.Limit {
			res.IsLastPage = false
			break
		}
		res.Bots = append(res.Bots, r.item)
	}
	return res, nil
}

func (l *FeaturedBotLoader) Search(mctx libkb.MetaContext, arg keybase1.SearchArg) (res keybase1.SearchRes, err error) {
	defer mctx.Trace("FeaturedBotLoader: Search", &err)()
	defer func() {
		if err == nil {
			res.Bots = l.present(mctx, res.Bots)
		}
	}()
	apiRes, err := mctx.G().API.Get(mctx, libkb.APIArg{
		Endpoint:    "featured_bots/search",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"query":  libkb.S{Val: arg.Query},
			"limit":  libkb.I{Val: arg.Limit},
			"offset": libkb.I{Val: arg.Offset},
		},
	})
	if err != nil {
		return res, err
	}

	err = apiRes.Body.UnmarshalAgain(&res)
	return res, err
}

func (l *FeaturedBotLoader) featuredBotsFromServer(mctx libkb.MetaContext, arg keybase1.FeaturedBotsArg) (res keybase1.FeaturedBotsRes, err error) {
	apiRes, err := mctx.G().API.Get(mctx, libkb.APIArg{
		Endpoint:    "featured_bots/featured",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"limit":  libkb.I{Val: arg.Limit},
			"offset": libkb.I{Val: arg.Offset},
		},
	})
	if err != nil {
		return res, err
	}
	err = apiRes.Body.UnmarshalAgain(&res)
	return res, err
}

func (l *FeaturedBotLoader) dbKey(arg keybase1.FeaturedBotsArg) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBFeaturedBots,
		Key: fmt.Sprintf("fb:%d:%d", arg.Limit, arg.Offset),
	}
}

func (l *FeaturedBotLoader) featuredBotsFromStorage(mctx libkb.MetaContext, arg keybase1.FeaturedBotsArg) (res featuredBotsCache, found bool, err error) {
	dbKey := l.dbKey(arg)
	var cachedData featuredBotsCache
	found, err = mctx.G().GetKVStore().GetInto(&cachedData, dbKey)
	if err != nil || !found {
		return res, false, err
	}
	if !cachedData.isFresh() {
		l.debug(mctx, "featuredBotsFromStorage: data not fresh, ctime: %v", cachedData.Ctime)
		return res, false, nil
	}
	return cachedData, true, nil
}

func (l *FeaturedBotLoader) storeFeaturedBots(mctx libkb.MetaContext, arg keybase1.FeaturedBotsArg, res keybase1.FeaturedBotsRes) error {
	l.debug(mctx, "storeFeaturedBots: storing %d bots", len(res.Bots))
	dbKey := l.dbKey(arg)
	return mctx.G().GetKVStore().PutObj(dbKey, nil, featuredBotsCache{
		Data:  res,
		Ctime: gregor1.ToTime(time.Now()),
	})
}

func (l *FeaturedBotLoader) present(mctx libkb.MetaContext, bots []keybase1.FeaturedBot) (res []keybase1.FeaturedBot) {
	res = make([]keybase1.FeaturedBot, len(bots))
	for index, bot := range bots {
		res[index] = bot
		res[index].ExtendedDescriptionRaw = bot.ExtendedDescription
		res[index].ExtendedDescription = utils.PresentDecoratedUserBio(mctx.Ctx(), bot.ExtendedDescription)
	}
	return res
}

func (l *FeaturedBotLoader) shouldRefresh(cache *featuredBotsCache) bool {
	return cache == nil || time.Since(cache.Ctime.Time()) > refreshLifetime
}

func (l *FeaturedBotLoader) syncFeaturedBots(mctx libkb.MetaContext, arg keybase1.FeaturedBotsArg, cache *featuredBotsCache) (res keybase1.FeaturedBotsRes, err error) {
	defer mctx.Trace("FeaturedBotLoader: syncFeaturedBots", &err)()
	if !l.shouldRefresh(cache) {
		return res, nil
	}
	res, err = l.featuredBotsFromServer(mctx, arg)
	if err != nil {
		l.debug(mctx, "syncFeaturedBots: failed to load from server: %s", err)
		return res, err
	}
	if cache == nil || !res.Eq(cache.Data) { // only write out data if it changed
		if err := l.storeFeaturedBots(mctx, arg, res); err != nil {
			l.debug(mctx, "syncFeaturedBots: failed to store result: %s", err)
			return res, err
		}
	}
	l.G().NotifyRouter.HandleFeaturedBots(mctx.Ctx(), l.present(mctx, res.Bots), arg.Limit, arg.Offset)
	return res, nil
}

func (l *FeaturedBotLoader) FeaturedBots(mctx libkb.MetaContext, arg keybase1.FeaturedBotsArg) (res keybase1.FeaturedBotsRes, err error) {
	defer mctx.Trace("FeaturedBotLoader: FeaturedBots", &err)()
	defer func() {
		if err == nil {
			res.Bots = l.present(mctx, res.Bots)
		}
	}()
	if arg.SkipCache {
		return l.syncFeaturedBots(mctx, arg, nil)
	}
	// send up local copy first quickly
	cache, found, err := l.featuredBotsFromStorage(mctx, arg)
	if err != nil {
		l.debug(mctx, "FeaturedBots: failed to load from local storage: %s", err)
	} else if found {
		l.G().NotifyRouter.HandleFeaturedBots(mctx.Ctx(), l.present(mctx, cache.Data.Bots), arg.Limit, arg.Offset)
		go func() {
			mctx = libkb.NewMetaContextBackground(l.G())
			if _, err := l.syncFeaturedBots(mctx, arg, &cache); err != nil {
				l.debug(mctx, "FeaturedBots: unable to fetch from server in background: %v", err)
			}
		}()
		return cache.Data, err
	}
	return l.syncFeaturedBots(mctx, arg, nil)
}

func (l *FeaturedBotLoader) AllFeaturedBots(mctx libkb.MetaContext, skipCache bool) (res keybase1.FeaturedBotsRes, err error) {
	arg := keybase1.FeaturedBotsArg{
		Limit:     1000,
		Offset:    0,
		SkipCache: skipCache,
	}
	// Limit the number of iterations so a server bug doesn't cause an infinite
	// loop.
	for i := 0; !res.IsLastPage && i < 5; i++ {
		page, err := l.FeaturedBots(mctx, arg)
		if err != nil {
			return res, err
		}
		res.Bots = append(res.Bots, page.Bots...)
		res.IsLastPage = page.IsLastPage
		arg.Offset += arg.Limit
	}
	return res, nil
}
