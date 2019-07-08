package unfurl

import (
	"context"
	"errors"
	"io"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/colly"
)

func fullURL(hostname, path string) string {
	if strings.HasPrefix(path, "http") {
		return path
	} else if strings.HasPrefix(path, "//") {
		return "http:" + path
	} else {
		return "http://" + hostname + path
	}
}

func (s *Scraper) setAndParsePubTime(ctx context.Context, content string, generic *scoredGenericRaw, score int) {
	s.Debug(ctx, "scrapeGeneric: pubdate: %s", content)
	formats := []string{
		"2006-01-02T15:04:05Z",
		"20060102",
	}
	var t time.Time
	var err error
	for _, f := range formats {
		if t, err = time.Parse(f, content); err != nil {
			s.Debug(ctx, "scrapeGeneric: failed to parse pubdate: format: %s err: %s", f, err)
		} else {
			break
		}
	}
	if err != nil {
		s.Debug(ctx, "scrapeGeneric: failed to parse pubdate with any format")
	} else {
		publishTime := int(t.Unix())
		s.Debug(ctx, "scrapeGeneric: success: %d", publishTime)
		generic.setPublishTime(&publishTime, score)
	}
}

func (s *Scraper) setAttr(ctx context.Context, attr, hostname, domain string, generic *scoredGenericRaw,
	e *colly.HTMLElement) {
	ranker, ok := attrRankMap[attr]
	if !ok { // invalid attribute, ignore
		return
	}
	contents := ranker.content(e)
	score := ranker.score(domain, e)
	for _, content := range contents {
		content = strings.Trim(content, " ")
		if content == "" {
			continue
		}
		switch ranker.setter {
		case setTitle:
			generic.setTitle(content, score)
		case setURL:
			url := fullURL(hostname, content)
			generic.setURL(url, score)
		case setSiteName:
			generic.setSiteName(content, score)
		case setFaviconURL:
			url := fullURL(hostname, content)
			generic.setFaviconURL(&url, score)
		case setImageURL:
			url := fullURL(hostname, content)
			generic.setImageURL(&url, score)
		case setPublishTime:
			s.setAndParsePubTime(ctx, content, generic, score)
		case setDescription:
			generic.setDescription(&content, score)
		case setVideo:
			generic.setVideo(content, score)
		}
	}
}

type bodyReadResetter struct {
	io.ReadCloser
}

func (b bodyReadResetter) Reset() error {
	return nil
}

func (s *Scraper) tryAppleTouchIcon(ctx context.Context, generic *scoredGenericRaw, uri, domain string) {
	path, err := GetDefaultAppleTouchURL(uri)
	if err != nil {
		s.Debug(ctx, "tryAppleTouchIcon: failed to get Apple touch URL: %s", err)
		return
	}
	resp, err := libkb.ProxyHTTPGet(s.G().Env, path)
	if err != nil {
		s.Debug(ctx, "tryAppleTouchIcon: failed to read Apple touch icon: %s", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode <= 299 {
		s.Debug(ctx, "tryAppleTouchIcon: found Apple touch icon at known path")
		mimeType, err := attachments.DetectMIMEType(ctx, bodyReadResetter{ReadCloser: resp.Body},
			"apple-touch-icon.png")
		if err != nil {
			s.Debug(ctx, "tryAppleTouchIcon: failed to get MIME type from response: %s", err)
			return
		}
		if mimeType != "image/png" {
			s.Debug(ctx, "tryAppleTouchIcon: response not a PNG: %s", mimeType)
			return
		}
		generic.setFaviconURL(&path, getAppleTouchFaviconScoreFromPath())
	}
}

func (s *Scraper) addGenericScraperToCollector(ctx context.Context, c *colly.Collector,
	generic *scoredGenericRaw, uri, domain string) error {
	// default favicon location as a fallback
	defaultFaviconURL, err := GetDefaultFaviconURL(uri)
	if err != nil {
		return err
	}
	hostname, err := GetHostname(uri)
	if err != nil {
		return err
	}
	generic.setURL(uri, 0)
	generic.setSiteName(domain, 0)
	generic.setFaviconURL(&defaultFaviconURL, 0)

	c.OnResponse(func(r *colly.Response) {
		contentType := r.Headers.Get("content-type")
		if contentType == "image/jpeg" || contentType == "image/png" || contentType == "image/gif" {
			generic.ImageUrl = &uri
		}
	})
	// Run the Colly scraper
	c.OnHTML("head title", func(e *colly.HTMLElement) {
		s.setAttr(ctx, "title", hostname, domain, generic, e)
	})
	c.OnHTML("head link[rel][href]", func(e *colly.HTMLElement) {
		rel := strings.ToLower(e.Attr("rel"))
		if strings.Contains(rel, "apple-touch-icon") {
			s.setAttr(ctx, "apple-touch-icon", hostname, domain, generic, e)
		} else if strings.Contains(rel, "shortcut icon") {
			s.setAttr(ctx, "shortcut icon", hostname, domain, generic, e)
		} else if strings.Contains(rel, "icon") &&
			(e.Attr("type") == "image/x-icon" || e.Attr("type") == "image/png") {
			s.setAttr(ctx, "icon", hostname, domain, generic, e)
		}
	})
	c.OnHTML("head meta[content][name]", func(e *colly.HTMLElement) {
		attr := strings.ToLower(e.Attr("name"))
		s.setAttr(ctx, attr, hostname, domain, generic, e)
	})
	c.OnHTML("head meta[content][property]", func(e *colly.HTMLElement) {
		attr := strings.ToLower(e.Attr("property"))
		s.setAttr(ctx, attr, hostname, domain, generic, e)
	})
	return nil
}

func (s *Scraper) isValidGenericScrape(generic chat1.UnfurlGenericRaw) bool {
	return len(generic.Title) > 0 || (generic.Description != nil && len(*generic.Description) > 0) ||
		generic.ImageUrl != nil || generic.Video != nil
}

func (s *Scraper) exportGenericResult(generic *scoredGenericRaw) (res chat1.UnfurlRaw, err error) {
	// Check to make sure we have a legit unfurl that is useful
	if !s.isValidGenericScrape(generic.UnfurlGenericRaw) {
		return res, errors.New("not enough information to display")
	}
	return chat1.NewUnfurlRawWithGeneric(generic.UnfurlGenericRaw), nil
}

func (s *Scraper) scrapeGeneric(ctx context.Context, uri, domain string) (res chat1.UnfurlRaw, err error) {
	// setup some defaults with score 0 and hope we can find better info.
	generic := new(scoredGenericRaw)
	c := s.makeCollector()
	if err = s.addGenericScraperToCollector(ctx, c, generic, uri, domain); err != nil {
		return res, err
	}
	if err := c.Visit(uri); err != nil {
		return res, err
	}
	// Try to get Apple touch icon from known URL if we are going to use one that is worse
	if generic.faviconURLScore < getAppleTouchFaviconScoreFromPath() {
		s.Debug(ctx, "scrapeGeneric: favicon score below Apple touch score, trying to find it")
		s.tryAppleTouchIcon(ctx, generic, uri, domain)
	}
	return s.exportGenericResult(generic)
}
