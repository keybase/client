package maps

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"image"
	"image/png"
	"io"
	"net/http"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/image/draw"
	"golang.org/x/net/context/ctxhttp"
)

// For more information about the Google Maps Static API, head here:
// https://developers.google.com/maps/documentation/maps-static/dev-guide

const MapsProxy = "maps-proxy.core.keybaseapi.com"
const mapsHost = "maps.googleapis.com"
const scale = 2
const locationMapWidth = 640
const locationMapHeight = 350
const liveMapWidth = 640
const liveMapHeight = 350
const liveMapWidthScaled = liveMapWidth / scale
const liveMapHeightScaled = liveMapHeight / scale

func GetMapURL(ctx context.Context, apiKeySource types.ExternalAPIKeySource, lat, lon float64) (string, error) {
	return GetCustomMapURL(ctx, apiKeySource, lat, lon, locationMapWidth, locationMapHeight)
}

func GetCustomMapURL(ctx context.Context, apiKeySource types.ExternalAPIKeySource, lat, lon float64,
	width, height int) (string, error) {
	key, err := apiKeySource.GetKey(ctx, chat1.ExternalAPIKeyTyp_GOOGLEMAPS)
	if err != nil {
		return "", err
	}
	widthScaled := width / scale
	heightScaled := height / scale
	return fmt.Sprintf(
		"https://%s/maps/api/staticmap?zoom=18&center=%f,%f&size=%dx%d&scale=%d&key=%s",
		MapsProxy, lat, lon, widthScaled, heightScaled, scale,
		key.Googlemaps()), nil

}

func GetLiveMapURL(ctx context.Context, apiKeySource types.ExternalAPIKeySource, coords []chat1.Coordinate) (string, error) {
	if len(coords) == 0 {
		return "", errors.New("empty coords")
	}
	key, err := apiKeySource.GetKey(ctx, chat1.ExternalAPIKeyTyp_GOOGLEMAPS)
	if err != nil {
		return "", err
	}
	var pathStr, centerStr string
	last := coords[len(coords)-1]
	centerStr = fmt.Sprintf("center=%f,%f&", last.Lat, last.Lon)
	if len(coords) > 1 {
		pathStr = "path=color:0x4c8effff|weight:5"
		for _, c := range coords {
			pathStr += fmt.Sprintf("|%f,%f", c.Lat, c.Lon)
		}
		pathStr += "&"
	}
	url := fmt.Sprintf(
		"https://%s/maps/api/staticmap?zoom=18&%s%ssize=%dx%d&scale=%d&key=%s",
		MapsProxy, centerStr, pathStr, liveMapWidthScaled,
		liveMapHeightScaled, scale, key.Googlemaps())
	return url, nil
}

func GetExternalMapURL(ctx context.Context, lat, lon float64) string {
	return fmt.Sprintf("https://www.google.com/maps/place/%f,%f/@%f,%f,15z", lat, lon, lat, lon)
}

func httpClient(g *libkb.GlobalContext, host string) *http.Client {
	var xprt http.Transport
	tlsConfig := &tls.Config{
		ServerName: host,
	}
	xprt.TLSClientConfig = tlsConfig
	return &http.Client{
		Transport: libkb.NewInstrumentedRoundTripper(g,
			func(*http.Request) string { return "LocationShare" }, libkb.NewClosingRoundTripper(&xprt)),
		Timeout: 10 * time.Second,
	}
}

func MapReaderFromURL(ctx context.Context, g *globals.Context, url string) (res io.ReadCloser, length int64, err error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Host = mapsHost
	resp, err := ctxhttp.Do(ctx, httpClient(g.ExternalG(), mapsHost), req)
	if err != nil {
		return nil, 0, err
	}
	return resp.Body, resp.ContentLength, nil
}

func DecorateMap(ctx context.Context, avatarReader, mapReader io.Reader) (res io.ReadCloser, length int64, err error) {
	avatarImg, _, err := image.Decode(avatarReader)
	if err != nil {
		return res, length, err
	}
	avatarRadius := avatarImg.Bounds().Dx() / 2

	mapPng, err := png.Decode(mapReader)
	if err != nil {
		return res, length, err
	}
	bounds := mapPng.Bounds()

	middle := image.Point{bounds.Max.X / 2, bounds.Max.Y / 2}
	iconRect := image.Rect(middle.X-avatarRadius, middle.Y-avatarRadius, middle.X+avatarRadius, middle.Y+avatarRadius)

	decorated := image.NewRGBA(bounds)
	draw.Draw(decorated, bounds, mapPng, image.Point{}, draw.Src)
	draw.Draw(decorated, iconRect, avatarImg, image.Point{}, draw.Over)

	var buf bytes.Buffer
	err = png.Encode(&buf, decorated)
	if err != nil {
		return res, length, err
	}
	return io.NopCloser(bytes.NewReader(buf.Bytes())), int64(buf.Len()), nil
}
