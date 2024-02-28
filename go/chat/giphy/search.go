package giphy

import (
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context/ctxhttp"
)

const APIHost = "api.giphy.com"
const MediaHost = "media.giphy.com"
const Host = "giphy.com"
const giphyProxy = "https://giphy-proxy.core.keybaseapi.com"

func getPreferredPreview(mctx libkb.MetaContext, img gifImage) (string, bool, error) {
	isMobile := mctx.G().IsMobileAppType()
	if len(img.MP4) == 0 && len(img.URL) == 0 {
		return "", false, errors.New("no preview")
	}
	if len(img.MP4) == 0 {
		return img.URL, false, nil
	}
	if len(img.URL) == 0 {
		if isMobile {
			return "", false, errors.New("need gif for mobile")
		}
		return img.MP4, true, nil
	}
	if isMobile {
		return img.URL, false, nil
	}
	return img.MP4, true, nil
}

func getTargetURL(mctx libkb.MetaContext, images map[string]gifImage) (string, error) {
	adorn := func(url string, isVideo bool, img gifImage) string {
		return fmt.Sprintf("%s#height=%s&width=%s&isvideo=%v", url, img.Height, img.Width, isVideo)
	}
	for typ, img := range images {
		if typ != "original" {
			continue
		}
		if len(img.MP4) == 0 && len(img.URL) == 0 {
			return "", errors.New("no gif target")
		}
		if len(img.MP4) == 0 {
			return adorn(img.URL, false, img), nil
		}
		return adorn(img.MP4, true, img), nil
	}
	return "", errors.New("no original target found")
}

func formatResponse(mctx libkb.MetaContext, response giphyResponse, srv types.AttachmentURLSrv) (res []chat1.GiphySearchResult) {
	var err error
	for _, obj := range response.Data {
		var searchRes chat1.GiphySearchResult
		foundPreview := true
		for typ, img := range obj.Images {
			select {
			case <-mctx.Ctx().Done():
				return
			default:
			}
			if typ != "fixed_height" {
				continue
			}
			searchRes.PreferredPreviewUrl, searchRes.PreviewIsVideo, err = getPreferredPreview(mctx, img)
			if err != nil {
				continue
			}
			searchRes.PreviewHeight, err = strconv.Atoi(img.Height)
			if err != nil {
				continue
			}
			searchRes.PreviewWidth, err = strconv.Atoi(img.Width)
			if err != nil {
				continue
			}
			searchRes.PreviewUrl = srv.GetGiphyURL(mctx.Ctx(), searchRes.PreferredPreviewUrl)
			foundPreview = true
			break
		}
		if foundPreview {
			searchRes.TargetUrl, err = getTargetURL(mctx, obj.Images)
			if err != nil {
				continue
			}
			res = append(res, searchRes)
		}
	}
	return res
}

func httpClient(mctx libkb.MetaContext, host string) *http.Client {
	var xprt http.Transport
	tlsConfig := &tls.Config{
		ServerName: host,
	}
	xprt.TLSClientConfig = tlsConfig

	env := mctx.G().Env
	xprt.Proxy = libkb.MakeProxy(env)

	return &http.Client{
		Transport: libkb.NewInstrumentedRoundTripper(mctx.G(),
			func(*http.Request) string { return host + " Giphy" }, libkb.NewClosingRoundTripper(&xprt)),
		Timeout: 10 * time.Second,
	}
}

func APIClient(mctx libkb.MetaContext) *http.Client {
	return httpClient(mctx, APIHost)
}

func AssetClient(mctx libkb.MetaContext) *http.Client {
	return httpClient(mctx, MediaHost)
}

func WebClient(mctx libkb.MetaContext) *http.Client {
	return httpClient(mctx, Host)
}

func runAPICall(mctx libkb.MetaContext, endpoint string, srv types.AttachmentURLSrv) (res []chat1.GiphySearchResult, err error) {
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return res, err
	}
	req.Host = APIHost

	resp, err := ctxhttp.Do(mctx.Ctx(), APIClient(mctx), req)
	if err != nil {
		return res, err
	}
	defer resp.Body.Close()
	dat, err := io.ReadAll(resp.Body)
	if err != nil {
		return res, err
	}
	var response giphyResponse
	if err := json.Unmarshal(dat, &response); err != nil {
		return res, err
	}
	return formatResponse(mctx, response, srv), nil
}

func ProxyURL(sourceURL string) (res string, err error) {
	u, err := url.Parse(sourceURL)
	if err != nil {
		return res, err
	}
	return fmt.Sprintf("%s%s", giphyProxy, u.Path), nil
}

func Asset(mctx libkb.MetaContext, sourceURL string) (res io.ReadCloser, length int64, err error) {
	proxyURL, err := ProxyURL(sourceURL)
	if err != nil {
		return nil, 0, err
	}
	req, err := http.NewRequest("GET", proxyURL, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Add("Accept", "image/*")
	req.Host = MediaHost
	resp, err := ctxhttp.Do(mctx.Ctx(), AssetClient(mctx), req)
	if err != nil {
		return nil, 0, err
	}

	if resp.StatusCode != 200 {
		return nil, 0, fmt.Errorf("Status %s", resp.Status)
	}
	return resp.Body, resp.ContentLength, nil
}

func Search(g *globals.Context, mctx libkb.MetaContext, apiKeySource types.ExternalAPIKeySource, query *string, limit int,
	srv types.AttachmentURLSrv) (res []chat1.GiphySearchResult, err error) {
	var endpoint string
	apiKey, err := apiKeySource.GetKey(mctx.Ctx(), chat1.ExternalAPIKeyTyp_GIPHY)
	if err != nil {
		return res, err
	}
	if query != nil {
		endpoint = fmt.Sprintf("%s/v1/gifs/search?api_key=%s&q=%s&limit=%d", giphyProxy, apiKey.Giphy(),
			url.QueryEscape(*query), limit)
		return runAPICall(mctx, endpoint, srv)
	}

	// If we have no query first check the local store for recently used results.
	recentlyUsedLimit := 7
	if mctx.G().IsMobileAppType() {
		recentlyUsedLimit = 3
	}

	results := storage.NewGiphyStore(g).GiphyResults(mctx.Ctx(), mctx.CurrentUID().ToBytes(), recentlyUsedLimit)
	// Refresh the local url for any previously cached results.
	seenPreviewURLs := make(map[string]bool)
	for i, result := range results {
		result.PreviewUrl = srv.GetGiphyURL(mctx.Ctx(), result.PreferredPreviewUrl)
		results[i] = result
		seenPreviewURLs[result.PreviewUrl] = true
	}

	if len(results) > limit {
		results = results[:limit]
	} else if len(results) < limit { // grab trending if we don't have enough recents
		limit -= len(results)
		endpoint = fmt.Sprintf("%s/v1/gifs/trending?api_key=%s&limit=%d", giphyProxy, apiKey.Giphy(), limit)
		trendingResults, err := runAPICall(mctx, endpoint, srv)
		if err != nil {
			return nil, err
		}
		// Filter out any results already from the cached response.
		for _, result := range trendingResults {
			if !seenPreviewURLs[result.PreviewUrl] {
				results = append(results, result)
				seenPreviewURLs[result.PreviewUrl] = true
			}
		}
	}
	return results, nil
}
