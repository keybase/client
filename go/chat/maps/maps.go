package maps

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"io"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
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
		"https://%s/maps/api/staticmap?zoom=17&center=%f,%f&size=%dx%d&scale=%d&key=%s",
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
		"https://%s/maps/api/staticmap?zoom=17&%s%ssize=%dx%d&scale=%d&key=%s",
		MapsProxy, centerStr, pathStr, liveMapWidthScaled,
		liveMapHeightScaled, scale, key.Googlemaps())
	return url, nil
}

func CombineMaps(ctx context.Context, locReader, liveReader io.Reader) (res io.ReadCloser, length int64, err error) {
	sepHeight := 3
	locPng, err := png.Decode(locReader)
	if err != nil {
		return res, length, err
	}
	livePng, err := png.Decode(liveReader)
	if err != nil {
		return res, length, err
	}
	combined := image.NewRGBA(image.Rect(0, 0, locationMapWidth, locationMapHeight+liveMapHeight+sepHeight))
	for x := 0; x < locPng.Bounds().Dx(); x++ {
		for y := 0; y < locPng.Bounds().Dy(); y++ {
			combined.Set(x, y, locPng.At(x, y))
		}
	}
	for x := 0; x < locPng.Bounds().Dx(); x++ {
		for y := 0; y < sepHeight; y++ {
			combined.Set(x, locationMapHeight+y, color.Black)
		}
	}
	for x := 0; x < livePng.Bounds().Dx(); x++ {
		for y := 0; y < livePng.Bounds().Dy(); y++ {
			combined.Set(x, y+locationMapHeight+sepHeight, livePng.At(x, y))
		}
	}
	var buf bytes.Buffer
	err = png.Encode(&buf, combined)
	if err != nil {
		return res, length, err
	}
	return ioutil.NopCloser(bytes.NewReader(buf.Bytes())), int64(buf.Len()), nil
}

func GetExternalMapURL(ctx context.Context, lat, lon float64) string {
	return fmt.Sprintf("https://www.google.com/maps/place/%f,%f/@%f,%f,15z", lat, lon, lat, lon)
}

func httpClient(host string) *http.Client {
	var xprt http.Transport
	tlsConfig := &tls.Config{
		ServerName: host,
	}
	xprt.TLSClientConfig = tlsConfig
	return &http.Client{
		Transport: &xprt,
		Timeout:   10 * time.Second,
	}
}

func MapReaderFromURL(ctx context.Context, url string) (res io.ReadCloser, length int64, err error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return res, length, err
	}
	req.Host = mapsHost
	resp, err := ctxhttp.Do(ctx, httpClient(mapsHost), req)
	if err != nil {
		return res, length, err
	}
	return resp.Body, resp.ContentLength, nil
}

func DecorateMap(ctx context.Context, username string, mapReader io.Reader) (res io.ReadCloser, length int64, err error) {
	// TODO: fetch actual user avatar
	req, err := http.NewRequest("GET", "https://01.keybase.pub/icon128-test.png", nil)
	if err != nil {
		return res, length, err
	}

	req.Host = "01.keybase.pub"
	avatarResp, err := ctxhttp.Do(ctx, httpClient("01.keybase.pub"), req)
	if err != nil {
		return res, length, err
	}
	avatarPng, err := png.Decode(avatarResp.Body)
	avatarRadius := avatarPng.Bounds().Dx() / 2

	mapPng, err := png.Decode(mapReader)
	if err != nil {
		return res, length, err
	}
	bounds := mapPng.Bounds()

	middle := image.Point{bounds.Max.X / 2, bounds.Max.Y / 2}
	iconRect := image.Rect(middle.X-avatarRadius, middle.Y-avatarRadius, middle.X+avatarRadius, middle.Y+avatarRadius)
	mask := &circle{image.Point{avatarRadius, avatarRadius}, avatarRadius}

	decorated := image.NewRGBA(bounds)
	draw.Draw(decorated, bounds, mapPng, image.ZP, draw.Src)
	draw.Draw(decorated, bounds, &circle{middle, avatarRadius + 10}, image.ZP, draw.Over)
	draw.DrawMask(decorated, iconRect, avatarPng, image.ZP, mask, image.ZP, draw.Over)

	var buf bytes.Buffer
	err = png.Encode(&buf, decorated)
	if err != nil {
		return res, length, err
	}
	return ioutil.NopCloser(bytes.NewReader(buf.Bytes())), int64(buf.Len()), nil
}

type circle struct {
	p image.Point
	r int
}

func (c *circle) ColorModel() color.Model {
	return color.AlphaModel
}

func (c *circle) Bounds() image.Rectangle {
	return image.Rect(c.p.X-c.r, c.p.Y-c.r, c.p.X+c.r, c.p.Y+c.r)
}

func (c *circle) At(x, y int) color.Color {
	xx, yy, rr := float64(x-c.p.X)+0.1, float64(y-c.p.Y)+0.1, float64(c.r)
	if xx*xx+yy*yy < rr*rr {
		return color.Alpha{255}
	}
	return color.Alpha{0}
}
