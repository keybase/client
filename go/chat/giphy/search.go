package giphy

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context/ctxhttp"
)

const apiKey = "ZsqoY64vpeo53oZH5ShgywcjLu1W8rIe"
const giphyHost = "https://api.giphy.com"

func formatResponse(ctx context.Context, response giphyResponse, srv types.AttachmentURLSrv) (res []chat1.GiphySearchResult) {
	for _, obj := range response.Data {
		for typ, img := range obj.Images {
			select {
			case <-ctx.Done():
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
				PreviewUrl:     srv.GetGiphyURL(ctx, img.MP4),
				PreviewHeight:  height,
				PreviewWidth:   width,
				PreviewIsVideo: true,
			})
		}
	}
	return res
}

func runCall(ctx context.Context, endpoint string, srv types.AttachmentURLSrv) (res []chat1.GiphySearchResult, err error) {
	resp, err := ctxhttp.Get(ctx, http.DefaultClient, endpoint)
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
	return formatResponse(ctx, response, srv), nil
}

func Search(ctx context.Context, query *string, srv types.AttachmentURLSrv) (res []chat1.GiphySearchResult, err error) {
	var endpoint string
	if query == nil {
		// grab trending with no query
		endpoint = fmt.Sprintf("%s/v1/gifs/trending?api_key=%s", giphyHost, apiKey)
	} else {
		endpoint = fmt.Sprintf("%s/v1/gifs/search?api_key=%s&q=%s", giphyHost, apiKey,
			url.QueryEscape(*query))
	}
	return runCall(ctx, endpoint, srv)
}
