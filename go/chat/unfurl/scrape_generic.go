package unfurl

import (
	"context"
	"strings"
	"time"

	"github.com/gocolly/colly"
	"github.com/keybase/client/go/protocol/chat1"
)

func fullURL(hostname, path string) string {
	if strings.HasPrefix(path, "//") {
		return "http:" + path
	} else if strings.HasPrefix(path, "/") {
		return "http://" + hostname + path
	}
	return path
}

func (s *Scraper) scrapeGeneric(ctx context.Context, uri, domain string) (res chat1.UnfurlRaw, err error) {
	var generic chat1.UnfurlGenericRaw
	hostname, err := GetHostname(uri)
	if err != nil {
		return res, err
	}
	generic.Url = uri
	generic.SiteName = domain
	c := colly.NewCollector()
	c.OnHTML("head meta[content][property]", func(e *colly.HTMLElement) {
		prop := e.Attr("property")
		content := e.Attr("content")
		switch prop {
		case "og:description":
			generic.Description = &content
		case "og:image":
			generic.ImageUrl = new(string)
			*generic.ImageUrl = fullURL(hostname, content)
		case "og:site_name":
			generic.SiteName = content
		case "og:pubdate":
			s.Debug(ctx, "pubdate: %s", content)
			t, err := time.Parse("2006-01-02T15:04:05Z", content)
			if err == nil {
				generic.PublishTime = new(int)
				*generic.PublishTime = int(t.Unix())
			} else {
				s.Debug(ctx, "scrapeGeneric: failed to parse pubdate: %s", err)
			}
		}
	})
	c.OnHTML("head title", func(e *colly.HTMLElement) {
		generic.Title = e.Text
	})
	c.OnHTML("head link[rel][href]", func(e *colly.HTMLElement) {
		rel := strings.ToLower(e.Attr("rel"))
		if strings.Contains(rel, "shortcut icon") {
			generic.FaviconUrl = new(string)
			*generic.FaviconUrl = fullURL(hostname, e.Attr("href"))
		}
	})
	if err := c.Visit(uri); err != nil {
		return res, err
	}
	return chat1.NewUnfurlRawWithGeneric(generic), nil
}
