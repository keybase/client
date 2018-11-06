package unfurl

import (
	"context"
	"strings"
	"time"

	"github.com/gocolly/colly"
	"github.com/keybase/client/go/protocol/chat1"
)

const (
	defaultScore          = 1
	defaultOpenGraphScore = 10
)

func getOpenGraphScore(domain string) int {
	switch domain {
	default:
		return defaultOpenGraphScore
	}
}

func fullURL(hostname, path string) string {
	if strings.HasPrefix(path, "//") {
		return "http:" + path
	} else if strings.HasPrefix(path, "/") {
		return "http://" + hostname + path
	}
	return path
}

func (s *Scraper) scrapeGeneric(ctx context.Context, uri, domain string) (res chat1.UnfurlRaw, err error) {
	hostname, err := GetHostname(uri)
	if err != nil {
		return res, err
	}
	generic := new(chat1.UnfurlGenericRaw)
	generic.SetUrl(uri, defaultScore)
	generic.SetSiteName(domain, defaultScore)

	c := colly.NewCollector()

	// scrape open graph tags
	c.OnHTML("head meta[content][property]", func(e *colly.HTMLElement) {
		openGraphScore := getOpenGraphScore(domain)
		prop := e.Attr("property")
		content := e.Attr("content")
		switch prop {
		case "og:description":
			generic.SetDescription(&content, openGraphScore)
		case "og:image":
			imageUrl := fullURL(hostname, e.Attr("href"))
			generic.SetImageUrl(&imageUrl, openGraphScore)
		case "og:site_name":
			generic.SetSiteName(content, openGraphScore)
		case "og:pubdate":
			s.Debug(ctx, "pubdate: %s", content)
			t, err := time.Parse("2006-01-02T15:04:05Z", content)
			if err == nil {
				publishTime := int(t.Unix())
				generic.SetPublishTime(&publishTime, openGraphScore)
			} else {
				s.Debug(ctx, "scrapeGeneric: failed to parse pubdate: %s", err)
			}
		}
	})

	// scrape title
	c.OnHTML("head title", func(e *colly.HTMLElement) {
		generic.SetTitle(e.Text, defaultScore)
	})

	// scrape favicon
	c.OnHTML("head link[rel][href]", func(e *colly.HTMLElement) {
		rel := strings.ToLower(e.Attr("rel"))
		if strings.Contains(rel, "shortcut icon") {
			faviconUrl := fullURL(hostname, e.Attr("href"))
			generic.SetFaviconUrl(&faviconUrl, defaultScore)
		}
	})

	if err := c.Visit(uri); err != nil {
		return res, err
	}
	return chat1.NewUnfurlRawWithGeneric(*generic), nil
}
