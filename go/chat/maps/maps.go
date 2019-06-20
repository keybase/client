package maps

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context/ctxhttp"
)

const MapsProxy = "maps-proxy.core.keybaseapi.com"
const mapsHost = "maps.googleapis.com"

func GetMapURL(ctx context.Context, apiKeySource types.ExternalAPIKeySource, lat, lon float64) (string, error) {
	key, err := apiKeySource.GetKey(ctx, chat1.ExternalAPIKeyTyp_GOOGLEMAPS)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(
		"https://%s/maps/api/staticmap?center=%f,%f&markers=color:red%%7C%f,%f&zoom=15&size=320x200&key=%s",
		MapsProxy, lat, lon, lat, lon, key.Googlemaps()), nil
}

func GetLiveMapURL(ctx context.Context, apiKeySource types.ExternalAPIKeySource, coords []chat1.Coordinate) (string, error) {
	key, err := apiKeySource.GetKey(ctx, chat1.ExternalAPIKeyTyp_GOOGLEMAPS)
	if err != nil {
		return "", err
	}
	pathStr := ""
	startStr := ""
	centerStr := ""
	if len(coords) > 1 {
		pathStr = "color:0xff0000ff|weight:3"
		for _, c := range coords {
			pathStr += fmt.Sprintf("|%f,%f", c.Lat, c.Lon)
		}
		pathStr += "&"
		startStr = fmt.Sprintf("markers=color:green%%7C%f,%f&", coords[0].Lat, coords[0].Lon)
	} else {
		centerStr = fmt.Sprintf("center=%f,%f&", coords[0].Lat, coords[0].Lon)
	}
	return fmt.Sprintf("https://%s/maps/api/staticmap?%s%s%smarkers=color:red%%7C%f,%f&size=320x200&key=%s",
		MapsProxy, centerStr, startStr, pathStr, coords[0].Lat, coords[0].Lon, key.Googlemaps()), nil
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
