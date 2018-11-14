package unfurl

import (
	"context"
	"strings"
	"time"

	"github.com/gocolly/colly"
	"github.com/keybase/client/go/protocol/chat1"
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
	s.Debug(ctx, "pubdate: %s", content)
	t, err := time.Parse("2006-01-02T15:04:05Z", content)
	if err != nil {
		s.Debug(ctx, "scrapeGeneric: failed to parse pubdate: %s", err)
	} else {
		publishTime := int(t.Unix())
		generic.setPublishTime(&publishTime, score)
	}
}

func (s *Scraper) setAttr(ctx context.Context, attr, hostname, domain string, generic *scoredGenericRaw, e *colly.HTMLElement) {
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
		}
	}
}

func (s *Scraper) scrapeGeneric(ctx context.Context, uri, domain string) (res chat1.UnfurlRaw, err error) {
	hostname, err := GetHostname(uri)
	if err != nil {
		return res, err
	}

	// default favicon location as a fallback
	defaultFaviconURL, err := GetDefaultFaviconURL(uri)
	if err != nil {
		return res, err
	}

	// setup some defaults with score 0 and hope we can find better info.
	generic := new(scoredGenericRaw)
	generic.setURL(uri, 0)
	generic.setSiteName(domain, 0)
	generic.setFaviconURL(&defaultFaviconURL, 0)

	c := colly.NewCollector()
	c.OnHTML("head title", func(e *colly.HTMLElement) {
		s.setAttr(ctx, "title", hostname, domain, generic, e)
	})
	c.OnHTML("head link[rel][href]", func(e *colly.HTMLElement) {
		rel := strings.ToLower(e.Attr("rel"))
		if strings.Contains(rel, "shortcut icon") {
			s.setAttr(ctx, "shortcut icon", hostname, domain, generic, e)
		} else if strings.Contains(rel, "icon") && e.Attr("type") == "image/x-icon" {
			s.setAttr(ctx, "icon", hostname, domain, generic, e)
		} else if strings.Contains(rel, "apple-touch-icon") {
			s.setAttr(ctx, "apple-touch-icon", hostname, domain, generic, e)
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

	if err := c.Visit(uri); err != nil {
		return res, err
	}
	return chat1.NewUnfurlRawWithGeneric(generic.UnfurlGenericRaw), nil
}
