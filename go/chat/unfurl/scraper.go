package unfurl

import (
	"context"

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

func (s *Scraper) scrapeGeneric() {}

func (s *Scraper) Scrape(ctx context.Context, uri string) (res chat1.Unfurl, err error) {
	defer s.Trace(ctx, func() error { return err }, "Scrape(%s)", uri)()
	domain, err := GetDomain(uri)
	if err != nil {
		return res, err
	}
}
