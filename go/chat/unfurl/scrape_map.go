package unfurl

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"time"

	"github.com/keybase/client/go/chat/maps"
	"github.com/keybase/client/go/chat/types"
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
	sdone := puri.Query().Get("done")
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
	done, err := strconv.ParseBool(sdone)
	if err != nil {
		return res, err
	}
	skey := puri.Query().Get("livekey")
	var liveMapURL *string
	var timeStr string
	siteName := "Location Share"
	mapURL, err := maps.GetMapURL(ctx, s.G().ExternalAPIKeySource, lat, lon)
	if err != nil {
		return res, err
	}
	linkURL := maps.GetExternalMapURL(ctx, lat, lon)
	if len(skey) > 0 {
		key := types.LiveLocationKey(skey)
		coords := s.G().LiveLocationTracker.GetCoordinates(ctx, key)
		liveMapURL = new(string)
		if *liveMapURL, err = maps.GetLiveMapURL(ctx, s.G().ExternalAPIKeySource, coords); err != nil {
			return res, err
		}
		timeStr = fmt.Sprintf("Posted %s.", time.Now().Format("15:04:05 MST"))
		siteName = "Live Location Share"
		if done {
			siteName += " (finished)"
		}
	}
	desc := fmt.Sprintf("Accurate to %dm. %s", int(acc), timeStr)
	return chat1.NewUnfurlRawWithMaps(chat1.UnfurlMapsRaw{
		Title:           "Open this location with Google Maps",
		Url:             linkURL,
		SiteName:        siteName,
		ImageUrl:        mapURL,
		Description:     desc,
		HistoryImageUrl: liveMapURL,
	}), nil
}
