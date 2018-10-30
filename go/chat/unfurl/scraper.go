package unfurl

import (
	"context"

	"github.com/gocolly/colly"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"

	"github.com/keybase/client/go/protocol/chat1"
)

type Scraper struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewScraper(g *globals.Context) *Scraper {
	return &Scraper{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Scraper", false),
	}
}

func (s *Scraper) scrapeGeneric(ctx context.Context, uri, domain string) (res chat1.Unfurl, err error) {
	var generic chat1.UnfurlGeneric
	c := colly.NewCollector(colly.AllowedDomains(domain))
	c.OnHTML("meta[content][property]", func(e *colly.HTMLElement) {
		prop := e.Attr("property")
		content := e.Attr("content")
		s.Debug(ctx, "scrapeGeneric: found property meta: prop: %s content: %s", prop, content)
	})
	if err := c.Visit(uri); err != nil {
		return res, err
	}
	return chat1.NewUnfurlWithGeneric(generic), nil
}

func (s *Scraper) Scrape(ctx context.Context, uri string) (res chat1.Unfurl, err error) {
	defer s.Trace(ctx, func() error { return err }, "Scrape(%s)", uri)()
	typ, domain, err := ClassifyDomainFromURI(uri)
	if err != nil {
		return res, err
	}
	switch typ {
	case chat1.UnfurlType_GENERIC:
		return s.scrapeGeneric(ctx, uri, domain)
	default:
		return s.scrapeGeneric(ctx, uri, domain)
	}
}
