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
}

func NewScraper(logger logger.Logger) *Scraper {
	return &Scraper{
		DebugLabeler: utils.NewDebugLabeler(logger, "Scraper", false),
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
	var unfurlTyp chat1.UnfurlType
	var domain string
	if forceTyp != nil {
		unfurlTyp = *forceTyp
	} else {
		var err error
		if unfurlTyp, domain, err = ClassifyDomainFromURI(uri); err != nil {
			return res, err
		}
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
