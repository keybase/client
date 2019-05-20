package giphy

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context/ctxhttp"
)

const apiKey = "ZsqoY64vpeo53oZH5ShgywcjLu1W8rIe"
const APIHost = "api.giphy.com"
const MediaHost = "media.giphy.com"
const Host = "giphy.com"
const giphyProxy = "https://giphy-proxy.core.keybaseapi.com"

func getPreferredPreview(mctx libkb.MetaContext, img gifImage) (string, bool, error) {
	isMobile := mctx.G().GetEnv().GetAppType() == libkb.MobileAppType
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
			searchRes.PreviewUrl, searchRes.PreviewIsVideo, err = getPreferredPreview(mctx, img)
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
			searchRes.PreviewUrl = srv.GetGiphyURL(mctx.Ctx(), searchRes.PreviewUrl)
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

func APIClient() *http.Client {
	return httpClient(APIHost)
}

func AssetClient() *http.Client {
	return httpClient(MediaHost)
}

func WebClient() *http.Client {
	return httpClient(Host)
}

func runAPICall(mctx libkb.MetaContext, endpoint string, srv types.AttachmentURLSrv) (res []chat1.GiphySearchResult, err error) {
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return res, err
	}
	req.Host = APIHost
	resp, err := ctxhttp.Do(mctx.Ctx(), APIClient(), req)
	if err != nil {
		return res, err
	}
	defer resp.Body.Close()
	dat, err := ioutil.ReadAll(resp.Body)
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

func Asset(ctx context.Context, sourceURL string) (res io.ReadCloser, length int64, err error) {
	proxyURL, err := ProxyURL(sourceURL)
	if err != nil {
		return res, length, err
	}
	req, err := http.NewRequest("GET", proxyURL, nil)
	if err != nil {
		return res, length, err
	}
	req.Header.Add("Accept", "image/*")
	req.Host = MediaHost
	resp, err := ctxhttp.Do(ctx, WebClient(), req)
	if err != nil {
		return res, length, err
	}
	return resp.Body, resp.ContentLength, nil
}

func Search(mctx libkb.MetaContext, query *string, limit int, srv types.AttachmentURLSrv) (res []chat1.GiphySearchResult, err error) {
	var endpoint string
	if query == nil {
		// grab trending with no query
		endpoint = fmt.Sprintf("%s/v1/gifs/trending?api_key=%s&limit=%d", giphyProxy, apiKey, limit)
	} else {
		endpoint = fmt.Sprintf("%s/v1/gifs/search?api_key=%s&q=%s&limit=%d", giphyProxy, apiKey,
			url.QueryEscape(*query), limit)
	}
	return runAPICall(mctx, endpoint, srv)
}
