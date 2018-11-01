package unfurl

import (
	"context"

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

func (s *Scraper) Scrape(ctx context.Context, uri string) (res chat1.UnfurlRaw, err error) {
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
