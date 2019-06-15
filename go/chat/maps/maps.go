package maps

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"golang.org/x/net/context/ctxhttp"
)

const mapsAPIKey = "AIzaSyAL0pIEYTxyVp6T5aK8eHQclmtNxCDEmZE"

func GetMapURL(ctx context.Context, lat, lon float64) string {
	return fmt.Sprintf(
		"https://maps.googleapis.com/maps/api/staticmap?center=%f,%f&zoom=15&size=320x319&key=%s",
		lat, lon, mapsAPIKey)
}

func MapReaderFromURL(ctx context.Context, url string) (res io.ReadCloser, length int64, err error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return res, length, err
	}
	resp, err := ctxhttp.Do(ctx, http.DefaultClient, req)
	if err != nil {
		return res, length, err
	}
	return resp.Body, resp.ContentLength, nil
}
