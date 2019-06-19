package unfurl

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/keybase/client/go/libkb"

	"github.com/keybase/client/go/chat/giphy"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/colly"
)

var giphyFavicon = "https://giphy.com/static/img/icons/apple-touch-icon-180px.png"

func (s *Scraper) scrapeGiphyWithMetadata(ctx context.Context, sourceURL string) (res chat1.UnfurlRaw, err error) {
	defer s.Trace(ctx, func() error { return err }, "scrapeGiphyWithMetadata")()
	url, err := url.Parse(sourceURL)
	if err != nil {
		return res, err
	}
	if url.Fragment == "" {
		return res, errors.New("no fragment")
	}
	toks := strings.Split(url.Fragment, "&")
	if len(toks) != 3 {
		return res, errors.New("not enough params")
	}
	var rawgiphy chat1.UnfurlGiphyRaw
	var video chat1.UnfurlVideo
	var height, width int64
	isVideo := false
	for _, tok := range toks {
		vals := strings.Split(tok, "=")
		if len(vals) != 2 {
			return res, errors.New("invalid val")
		}
		switch vals[0] {
		case "height":
			if height, err = strconv.ParseInt(vals[1], 0, 0); err != nil {
				return res, err
			}
		case "width":
			if width, err = strconv.ParseInt(vals[1], 0, 0); err != nil {
				return res, err
			}
		case "isvideo":
			if isVideo, err = strconv.ParseBool(vals[1]); err != nil {
				return res, err
			}
		}
	}
	rawgiphy.FaviconUrl = &giphyFavicon
	if isVideo {
		video.Height = int(height)
		video.Width = int(width)
		video.Url = sourceURL
		video.MimeType = "video/mp4"
		rawgiphy.Video = &video
	} else {
		rawgiphy.ImageUrl = &sourceURL
	}
	return chat1.NewUnfurlRawWithGiphy(rawgiphy), nil
}

func (s *Scraper) scrapeGiphy(ctx context.Context, sourceURL string) (res chat1.UnfurlRaw, err error) {
	defer s.Trace(ctx, func() error { return err }, "scrapeGiphy")()
	if res, err = s.scrapeGiphyWithMetadata(ctx, sourceURL); err == nil {
		s.Debug(ctx, "scrapeGiphy: successfully scraped with metadata")
		return res, nil
	}

	c := s.makeCollector()
	var rawgiphy chat1.UnfurlGiphyRaw
	var video chat1.UnfurlVideo
	video.MimeType = "video/mp4"
	generic := new(scoredGenericRaw)
	if err = s.addGenericScraperToCollector(ctx, c, generic, sourceURL, "giphy.com"); err != nil {
		return res, err
	}

	c.OnHTML("head meta[content][property]", func(e *colly.HTMLElement) {
		attr := strings.ToLower(e.Attr("property"))
		if attr == "og:video" {
			video.Url = e.Attr("content")
		} else if attr == "og:video:width" {
			if width, err := strconv.Atoi(e.Attr("content")); err == nil {
				video.Width = width
			}

		} else if attr == "og:video:height" {
			if height, err := strconv.Atoi(e.Attr("content")); err == nil {
				video.Height = height
			}
		} else {
			s.setAttr(ctx, attr, "giphy.com", "giphy.com", generic, e)
		}
	})
	var uri string
	if s.giphyProxy {
		c.WithTransport(giphy.WebClient(libkb.NewMetaContext(ctx, s.G().ExternalG())).Transport)
		if uri, err = giphy.ProxyURL(sourceURL); err != nil {
			return res, err
		}
	} else {
		uri = sourceURL
	}
	hdr := make(http.Header)
	hdr.Add("Host", giphy.Host)
	hdr.Add("Accept", "*/*")
	hdr.Add("Connection", "keep-alive")
	hdr.Add("upgrade-insecure-requests", "1")
	hdr.Add("user-agent", userAgent)
	if err := c.Request("GET", uri, nil, nil, hdr); err != nil {
		return res, err
	}
	if generic.ImageUrl == nil {
		// If we couldn't find an image, then just return the generic
		s.Debug(ctx, "scrapeGiphy: failed to find an image, just returning generic unfurl")
		return s.exportGenericResult(generic)
	}
	if len(video.Url) > 0 && video.Height > 0 && video.Width > 0 {
		rawgiphy.Video = &video
	}
	rawgiphy.ImageUrl = generic.ImageUrl
	rawgiphy.FaviconUrl = generic.FaviconUrl
	return chat1.NewUnfurlRawWithGiphy(rawgiphy), nil
}
