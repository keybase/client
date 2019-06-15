package maps

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"

	"golang.org/x/net/context/ctxhttp"
)

const mapsAPIKey = "AIzaSyAL0pIEYTxyVp6T5aK8eHQclmtNxCDEmZE"

func GetMapURL(ctx context.Context, lat, lon float64) string {
	return fmt.Sprintf(
		"https://maps.googleapis.com/maps/api/staticmap?center=%f,%f&zoom=15&size=320x320&key=%s",
		lat, lon, mapsAPIKey)
}

func LoadMapFromURL(ctx context.Context, url string) (res []byte, err error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return res, err
	}
	resp, err := ctxhttp.Do(ctx, http.DefaultClient, req)
	if err != nil {
		return res, err
	}
	defer resp.Body.Close()
	return ioutil.ReadAll(resp.Body)
}
