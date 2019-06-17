package unfurl

import (
	"context"
	"net/url"
	"strconv"

	"github.com/keybase/client/go/chat/maps"
	"github.com/keybase/client/go/protocol/chat1"
)

func (s *Scraper) scrapeMap(ctx context.Context, uri string) (res chat1.UnfurlRaw, err error) {
	defer s.Trace(ctx, func() error { return err }, "scrapeMap")()
	puri, err := url.Parse(uri)
	if err != nil {
		return res, err
	}
	slat := puri.Query().Get("lat")
	slon := puri.Query().Get("lon")
	lat, err := strconv.ParseFloat(slat, 64)
	if err != nil {
		return res, err
	}
	lon, err := strconv.ParseFloat(slon, 64)
	if err != nil {
		return res, err
	}
	mapURL := maps.GetMapURL(ctx, lat, lon)
	linkURL := maps.GetExternalMapURL(ctx, lat, lon)
	desc := "Shared with /location."
	return chat1.NewUnfurlRawWithMaps(chat1.UnfurlGenericRaw{
		Title:       "Open this location with Google Maps",
		Url:         linkURL,
		SiteName:    "Location Share",
		ImageUrl:    &mapURL,
		Description: &desc,
	}), nil
}
