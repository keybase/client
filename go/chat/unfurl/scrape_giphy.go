package unfurl

import (
	"context"

	"github.com/keybase/client/go/protocol/chat1"
)

func (s *Scraper) scrapeGiphy(ctx context.Context, uri string) (res chat1.UnfurlRaw, err error) {
	c := s.makeCollector()
	var giphy chat1.UnfurlGiphyRaw
	generic := new(scoredGenericRaw)
	if err = s.addGenericScraperToCollector(ctx, c, generic, uri, "giphy.com"); err != nil {
		return res, err
	}
	if err := c.Visit(uri); err != nil {
		return res, err
	}
	if generic.ImageUrl == nil {
		// If we couldn't find an image, then just return the generic
		s.Debug(ctx, "scrapeGiphy: failed to find an image, just returning generic unfurl")
		return chat1.NewUnfurlRawWithGeneric(generic.UnfurlGenericRaw), nil
	}
	giphy.ImageUrl = *generic.ImageUrl
	giphy.FaviconUrl = generic.FaviconUrl
	return chat1.NewUnfurlRawWithGiphy(giphy), nil
}
