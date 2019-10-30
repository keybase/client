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
	"github.com/keybase/client/go/protocol/gregor1"
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
	liveLocationDone, err := strconv.ParseBool(sdone)
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
	now := time.Now()
	var liveLocationEndTime *gregor1.Time
	if len(skey) > 0 {
		key := types.LiveLocationKey(skey)
		coords := s.G().LiveLocationTracker.GetCoordinates(ctx, key)
		endTime := s.G().LiveLocationTracker.GetEndTime(ctx, key)
		if endTime != nil {
			liveLocationEndTime = new(gregor1.Time)
			*liveLocationEndTime = gregor1.ToTime(*endTime)
		}
		liveMapURL = new(string)
		if *liveMapURL, err = maps.GetLiveMapURL(ctx, s.G().ExternalAPIKeySource, coords); err != nil {
			return res, err
		}
		timeStr = fmt.Sprintf("Posted %s.", now.Format("15:04:05 MST"))
		siteName = "Live Location Share"
		if liveLocationDone {
			desc := fmt.Sprintf("Last updated %s", now.Format("3:04 PM"))
			return chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
				Title:    "Location sharing ended.",
				SiteName: desc,
			}), nil
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
		Coord: chat1.Coordinate{
			Lat:      lat,
			Lon:      lon,
			Accuracy: acc,
		},
		LiveLocationDone:    liveLocationDone,
		LiveLocationEndTime: liveLocationEndTime,
		Time:                gregor1.ToTime(now),
	}), nil
}
