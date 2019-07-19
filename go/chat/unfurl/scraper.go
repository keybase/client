package unfurl

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/colly"
)

const userAgent = "Mozilla/5.0 (compatible; Keybase; +https://keybase.io)"

type Scraper struct {
	globals.Contextified
	utils.DebugLabeler
	cache      *unfurlCache
	giphyProxy bool
}

func NewScraper(g *globals.Context) *Scraper {
	return &Scraper{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Scraper", false),
		cache:        newUnfurlCache(),
		giphyProxy:   true,
	}
}

func (s *Scraper) makeCollector() *colly.Collector {
	c := colly.NewCollector(
		colly.UserAgent(userAgent),
	)
	c.OnRequest(func(r *colly.Request) {
		r.Headers.Set("connection", "keep-alive")
		r.Headers.Set("upgrade-insecure-requests", "1")
	})
	if s.G().Env.GetProxyType() != libkb.NoProxy {
		c.SetProxy(libkb.BuildProxyAddressWithProtocol(s.G().Env.GetProxyType(), s.G().Env.GetProxy()))
	}
	return c
}

func (s *Scraper) Scrape(ctx context.Context, uri string, forceTyp *chat1.UnfurlType) (res chat1.UnfurlRaw, err error) {
	defer s.Trace(ctx, func() error { return err }, "Scrape")()
	// Check if we have a cached valued
	if item, valid := s.cache.get(uri); valid {
		s.Debug(ctx, "Scape: using cached value")
		return item.data.(chat1.UnfurlRaw), nil
	}
	defer func() {
		if err == nil {
			s.cache.put(uri, res)
		}
	}()

	domain, err := GetDomain(uri)
	if err != nil {
		return res, err
	}

	var unfurlTyp chat1.UnfurlType
	if forceTyp != nil {
		unfurlTyp = *forceTyp
	} else {
		unfurlTyp = ClassifyDomain(domain)
	}

	switch unfurlTyp {
	case chat1.UnfurlType_GENERIC:
		return s.scrapeGeneric(ctx, uri, domain)
	case chat1.UnfurlType_GIPHY:
		return s.scrapeGiphy(ctx, uri)
	case chat1.UnfurlType_MAPS:
		return s.scrapeMap(ctx, uri)
	default:
		return s.scrapeGeneric(ctx, uri, domain)
	}
}
