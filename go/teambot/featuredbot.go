package teambot

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)


type featuredBotsCache struct  {
	Data keybase1.FeaturedBotsRes
	CTime gregor1.Time
}


type FeaturedBotLoader struct {
	Contextified
}

func NewFeaturedBotLoader(g *GlobalContext) *FeaturedBotLoader {
	return &FeaturedBotLoader{
		Contextified: NewContextified(g),
	}
}

func (l *FeaturedBotLoader) debug(ctx context.Context, msg string, args ...interface{}) {
	l.G().Log.CDebugf(ctx, "FeaturedBotLoader: %s", fmt.Sprintf(msg, args...))
}

func (l *FeaturedBotLoader) Search(mctx libkb.MetaContext, arg keybase1.SearchArg) (res keybase1.SearchRes, err error)
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

func (l *FeaturedBotLoader) featuredBotsFromServer(mctx libkb.MetaContext, arg keybase1.FeaturedBotsArg) (res keybase1.FeaturedBotsRes, err error)
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
	return libkb.DbKey {
		Typ: libkb.DBFeaturedBots,
		Key:fmt.Sprintf("fb:%d:%d", arg.Limit, arg.Offset),
	}
}

func (l *FeaturedBotLoader) featuredBotsFromStorage(mctx libkb.MetaContext, arg keybase1.FeaturedBotsArg) (res keybase1.FeaturedBotsRes, found bool, err error) {
	dbKey := l.dbKey(arg)
	var cachedData featuredBotsCache
		 found, err = mctx.G().GetKVStore().GetInto(&cachedData, dbKey)
		 if err != nil || !found{
			return res, false, err
		}

		if !cachedData.isFresh() {
			return res, false, nil
		}
		return cachedData.Data, true, nil

}

func (l *FeaturedBotLoader) syncFeaturedBots(mctx libkb.MetaContext,  arg keybase1.FeaturedBotsArg) (error) {
	res, err := l.featuredBotsFromServer(mctx, arg)
	if err != nil {
		l.debug(ctx, "load: failed to load from server: %s", err)
		return res, err
	}
	if err := l.storeFeaturedBots(mctx, arg, res); err != nil {
		l.debug(ctx, "load: failed to store result: %s", err)
		return res, err
	}
	l.G().NotifyRouter.HandleFeaturedBots(res)
	return res, nil
}

func (l *FeaturedBotLoader) FeaturedBots(mctx libkb.MetaContext, arg keybase1.FeaturedBotsArg) (res keybase1.FeaturedBotsRes, err error) {
	if arg.SkipCache {
	return l.syncFeaturedBots(mctx, arg)
}

	// send up local copy first quickly
	res, found, err := l.featuredBotsFromStorage(mctx, arg)
	if err != nil {
		l.debug(ctx, "load: failed to load from local storage: %s", err)
	} else if found {
		l.G().NotifyRouter.HandleFeaturedBots(res)
		go l.syncFeaturedBots(ctx, arg)
		return cachedData, err
	}
	return l.syncFeaturedBots(mctx, arg)
}

