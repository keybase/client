package giphy

import (
	"context"
	"crypto/tls"
	"encoding/json"
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

func formatResponse(mctx libkb.MetaContext, response giphyResponse, srv types.AttachmentURLSrv) (res []chat1.GiphySearchResult) {
	for _, obj := range response.Data {
		for typ, img := range obj.Images {
			select {
			case <-mctx.Ctx().Done():
				return
			default:
			}
			if typ != "fixed_height" {
				continue
			}
			if len(img.MP4) == 0 {
				continue
			}
			height, err := strconv.Atoi(img.Height)
			if err != nil {
				continue
			}
			width, err := strconv.Atoi(img.Width)
			if err != nil {
				continue
			}
			res = append(res, chat1.GiphySearchResult{
				TargetUrl:      obj.URL,
				PreviewUrl:     srv.GetGiphyURL(mctx.Ctx(), img.MP4),
				PreviewHeight:  height,
				PreviewWidth:   width,
				PreviewIsVideo: true,
			})
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
	//http2.ConfigureTransport(&xprt)
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

func Search(mctx libkb.MetaContext, query *string, srv types.AttachmentURLSrv) (res []chat1.GiphySearchResult, err error) {
	var endpoint string
	if query == nil {
		// grab trending with no query
		endpoint = fmt.Sprintf("%s/v1/gifs/trending?api_key=%s", giphyProxy, apiKey)
	} else {
		endpoint = fmt.Sprintf("%s/v1/gifs/search?api_key=%s&q=%s", giphyProxy, apiKey,
			url.QueryEscape(*query))
	}
	return runAPICall(mctx, endpoint, srv)
}
