package unfurl

import (
	"context"
	"fmt"
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
	desc := fmt.Sprintf("My current location coordinate is (%f,%f)", lat, lon)
	return chat1.NewUnfurlRawWithMaps(chat1.UnfurlGenericRaw{
		Title:       "Open this location with Google Maps",
		Url:         "https://maps.google.com",
		SiteName:    "Location Share",
		ImageUrl:    &mapURL,
		Description: &desc,
	}), nil
}
