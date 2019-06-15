package maps

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/net/context/ctxhttp"
)

const mapsAPIKey = "AIzaSyAL0pIEYTxyVp6T5aK8eHQclmtNxCDEmZE"
const mapsProxy = "maps-proxy.core.keybaseapi.com"
const mapsHost = "maps.googleapis.com"

func GetMapURL(ctx context.Context, lat, lon float64) string {
	return fmt.Sprintf(
		"https://%s/maps/api/staticmap?center=%f,%f&markers=color:red%%7C%f,%f&zoom=15&size=320x319&key=%s",
		mapsProxy, lat, lon, lat, lon, mapsAPIKey)
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
