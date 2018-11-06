package unfurl

import (
	"context"
	"strings"
	"time"

	"github.com/gocolly/colly"
	"github.com/keybase/client/go/protocol/chat1"
)

// Contents are scored based on source. Higher scores win but falsey values
// always loose.
const (
	defaultScore          = 1
	defaultOpenGraphScore = 10
	defaultTwitterScore   = 10
)

func getOpenGraphScore(domain string) int {
	switch domain {
	default:
		return defaultOpenGraphScore
	}
}

func getTwitterScore(domain string) int {
	switch domain {
	default:
		return defaultTwitterScore
	}
}

func fullURL(hostname, path string) string {
	if strings.HasPrefix(path, "http") {
		return path
	} else if strings.HasPrefix(path, "//") {
		return "http:" + path
	} else {
		return "http://" + hostname + path
	}
}

func (s *Scraper) setAndParsePubTime(ctx context.Context, content string, generic *chat1.UnfurlGenericRaw, score int) {
	s.Debug(ctx, "pubdate: %s", content)
	t, err := time.Parse("2006-01-02T15:04:05Z", content)
	if err != nil {
		s.Debug(ctx, "scrapeGeneric: failed to parse pubdate: %s", err)
	} else {
		publishTime := int(t.Unix())
		generic.SetPublishTime(&publishTime, score)
	}
}

func (s *Scraper) scrapeGeneric(ctx context.Context, uri, domain string) (res chat1.UnfurlRaw, err error) {
	// Setup some defaults with score 0 and hope we can find better info.
	generic := new(chat1.UnfurlGenericRaw)
	generic.SetUrl(uri, 0)
	generic.SetSiteName(domain, 0)

	// default favicon location as a fallback
	defaultFaviconUrl, err := GetDefaultFaviconUrl(uri)
	if err != nil {
		return res, err
	}
	generic.SetFaviconUrl(&defaultFaviconUrl, 0)

	hostname, err := GetHostname(uri)
	if err != nil {
		return res, err
	}

	c := colly.NewCollector()
	// scrape open graph tags
	c.OnHTML("head meta[content][property]", func(e *colly.HTMLElement) {
		score := getOpenGraphScore(domain)
		prop := strings.ToLower(e.Attr("property"))
		content := strings.Trim(e.Attr("content"), " ")
		switch prop {
		case "og:title":
			generic.SetTitle(content, score)
		case "og:url":
			generic.SetUrl(content, score)
		case "og:site_name":
			generic.SetSiteName(content, score)
		case "og:image":
			imageUrl := fullURL(hostname, e.Attr("href"))
			generic.SetImageUrl(&imageUrl, score)
			imageUrl = fullURL(hostname, content)
			generic.SetImageUrl(&imageUrl, score)
		case "og:pubdate":
			s.setAndParsePubTime(ctx, content, generic, score)
		case "og:description":
			generic.SetDescription(&content, score)
		}
	})

	// scrape twitter/non open graph
	c.OnHTML("head meta[content][name]", func(e *colly.HTMLElement) {
		score := getTwitterScore(domain)
		name := strings.ToLower(e.Attr("name"))
		content := strings.Trim(e.Attr("content"), " ")
		switch name {
		case "twitter:title":
			generic.SetTitle(content, score)
		case "twitter:image":
			imageUrl := fullURL(hostname, e.Attr("href"))
			generic.SetImageUrl(&imageUrl, score)
			imageUrl = fullURL(hostname, content)
			generic.SetImageUrl(&imageUrl, score)
		case "twitter:description":
			generic.SetDescription(&content, score)
		case "application-name":
			generic.SetSiteName(content, defaultScore)
		case "description":
			generic.SetDescription(&content, defaultScore)
		case "pubdate":
			s.setAndParsePubTime(ctx, content, generic, defaultScore)
		case "lastmod":
			s.setAndParsePubTime(ctx, content, generic, defaultScore)
		}
	})

	// scrape title
	c.OnHTML("head title", func(e *colly.HTMLElement) {
		generic.SetTitle(e.Text, defaultScore)
	})

	// scrape favicon
	c.OnHTML("head link[rel][href]", func(e *colly.HTMLElement) {
		rel := strings.ToLower(e.Attr("rel"))
		if strings.Contains(rel, "shortcut icon") ||
			(strings.Contains(rel, "icon") && e.Attr("type") == "image/x-icon") ||
			strings.Contains(rel, "apple-touch-icon") {
			faviconUrl := fullURL(hostname, e.Attr("href"))
			generic.SetFaviconUrl(&faviconUrl, defaultScore)
		}
	})

	if err := c.Visit(uri); err != nil {
		return res, err
	}
	return chat1.NewUnfurlRawWithGeneric(*generic), nil
}
