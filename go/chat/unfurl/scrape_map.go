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
	sacc := puri.Query().Get("acc")
	lat, err := strconv.ParseFloat(slat, 64)
	if err != nil {
		return res, err
	}
	lon, err := strconv.ParseFloat(slon, 64)
	if err != nil {
		return res, err
	}
	acc, err := strconv.ParseFloat(sacc, 64)
	if err != nil {
		return res, err
	}
	mapURL, err := maps.GetMapURL(ctx, s.G().ExternalAPIKeySource, lat, lon)
	if err != nil {
		return res, err
	}
	linkURL := maps.GetExternalMapURL(ctx, lat, lon)
	desc := fmt.Sprintf("Accurate to %dm.", int(acc))
	return chat1.NewUnfurlRawWithMaps(chat1.UnfurlGenericRaw{
		Title:       "Open this location with Google Maps",
		Url:         linkURL,
		SiteName:    "Location Share",
		ImageUrl:    &mapURL,
		Description: &desc,
	}), nil
}
