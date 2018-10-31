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

func (s *Scraper) scrapeGeneric(ctx context.Context, uri string) (res chat1.Unfurl, err error) {
	var generic chat1.UnfurlGeneric
	hostname, err := GetHostname(uri)
	if err != nil {
		return res, err
	}
	c := colly.NewCollector(colly.AllowedDomains(hostname))
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
	typ, _, err := ClassifyDomainFromURI(uri)
	if err != nil {
		return res, err
	}
	switch typ {
	case chat1.UnfurlType_GENERIC:
		return s.scrapeGeneric(ctx, uri)
	default:
		return s.scrapeGeneric(ctx, uri)
	}
}
