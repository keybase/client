package unfurl

import (
	"context"

	"github.com/gocolly/colly"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/logger"

	"github.com/keybase/client/go/protocol/chat1"
)

type Scraper struct {
	utils.DebugLabeler
	cache *unfurlCache
}

func NewScraper(logger logger.Logger) *Scraper {
	return &Scraper{
		DebugLabeler: utils.NewDebugLabeler(logger, "Scraper", false),
		cache:        newUnfurlCache(),
	}
}

func (s *Scraper) makeCollector() *colly.Collector {
	c := colly.NewCollector(
		colly.UserAgent("Mozilla/5.0 (compatible; Keybase; +https://keybase.io)"),
	)
	c.OnRequest(func(r *colly.Request) {
		r.Headers.Set("connection", "keep-alive")
		r.Headers.Set("upgrade-insecure-requests", "1")
	})
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
	default:
		return s.scrapeGeneric(ctx, uri, domain)
	}
}
