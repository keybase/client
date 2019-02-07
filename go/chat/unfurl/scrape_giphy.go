package unfurl

import (
	"context"
	"strconv"
	"strings"

	"github.com/keybase/client/go/chat/giphy"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/colly"
)

func (s *Scraper) scrapeGiphy(ctx context.Context, sourceURL string) (res chat1.UnfurlRaw, err error) {
	c := s.makeCollector()
	var rawgiphy chat1.UnfurlGiphyRaw
	var video chat1.UnfurlVideo
	video.MimeType = "video/mp4"
	generic := new(scoredGenericRaw)
	if err = s.addGenericScraperToCollector(ctx, c, generic, sourceURL, "giphy.com"); err != nil {
		return res, err
	}

	c.WithTransport(giphy.WebClient().Transport)
	c.OnRequest(func(r *colly.Request) {
		r.Headers.Add("Host", giphy.Host)
	})
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
	uri, err := giphy.ProxyURL(sourceURL)
	if err != nil {
		return res, err
	}
	if err := c.Visit(uri); err != nil {
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
	rawgiphy.ImageUrl = *generic.ImageUrl
	rawgiphy.FaviconUrl = generic.FaviconUrl
	return chat1.NewUnfurlRawWithGiphy(rawgiphy), nil
}
