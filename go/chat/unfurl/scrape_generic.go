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

// Score each attribute we parse from the webpage. If we encounter multiple
// sources we can use the highest rated one.
type scoredGenericRaw struct {
	chat1.UnfurlGenericRaw
	titleScore       int
	urlScore         int
	siteNameScore    int
	faviconURLScore  int
	imageURLScore    int
	publishTimeScore int
	descriptionScore int
}

func (g *scoredGenericRaw) setTitle(title string, score int) {
	if score > g.titleScore || g.Title == "" {
		g.Title = title
		g.titleScore = score
	}
}

func (g *scoredGenericRaw) setURL(url string, score int) {
	if score > g.urlScore || g.Url == "" {
		g.Url = url
		g.urlScore = score
	}
}

func (g *scoredGenericRaw) setSiteName(siteName string, score int) {
	if score > g.siteNameScore || g.SiteName == "" {
		g.SiteName = siteName
		g.siteNameScore = score
	}
}

func (g *scoredGenericRaw) setFaviconURL(faviconURL *string, score int) {
	if score > g.faviconURLScore || g.FaviconUrl == nil {
		g.FaviconUrl = faviconURL
		g.faviconURLScore = score
	}
}

func (g *scoredGenericRaw) setImageURL(imageURL *string, score int) {
	if score > g.imageURLScore || g.ImageUrl == nil {
		g.ImageUrl = imageURL
		g.imageURLScore = score
	}
}

func (g *scoredGenericRaw) setPublishTime(publishTime *int, score int) {
	if score > g.publishTimeScore || g.PublishTime == nil || (g.PublishTime != nil && publishTime != nil && *publishTime > *g.PublishTime) {
		g.PublishTime = publishTime
		g.publishTimeScore = score
	}
}

func (g *scoredGenericRaw) setDescription(description *string, score int) {
	if score > g.descriptionScore || g.Description == nil {
		g.Description = description
		g.descriptionScore = score
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

func (s *Scraper) scrapeGeneric(ctx context.Context, uri, domain string) (res chat1.UnfurlRaw, err error) {
	// setup some defaults with score 0 and hope we can find better info.
	generic := new(scoredGenericRaw)
	generic.setURL(uri, 0)
	generic.setSiteName(domain, 0)

	// default favicon location as a fallback
	defaultFaviconURL, err := GetDefaultFaviconURL(uri)
	if err != nil {
		return res, err
	}
	generic.setFaviconURL(&defaultFaviconURL, 0)

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
			generic.setTitle(content, score)
		case "og:url":
			generic.setURL(content, score)
		case "og:site_name":
			generic.setSiteName(content, score)
		case "og:image":
			imageURL := fullURL(hostname, e.Attr("href"))
			generic.setImageURL(&imageURL, score)
			imageURL = fullURL(hostname, content)
			generic.setImageURL(&imageURL, score)
		case "og:pubdate":
			s.setAndParsePubTime(ctx, content, generic, score)
		case "og:description":
			generic.setDescription(&content, score)
		}
	})

	// scrape twitter/non open graph
	c.OnHTML("head meta[content][name]", func(e *colly.HTMLElement) {
		score := getTwitterScore(domain)
		name := strings.ToLower(e.Attr("name"))
		content := strings.Trim(e.Attr("content"), " ")
		switch name {
		case "twitter:title":
			generic.setTitle(content, score)
		case "twitter:image":
			imageURL := fullURL(hostname, e.Attr("href"))
			generic.setImageURL(&imageURL, score)
			imageURL = fullURL(hostname, content)
			generic.setImageURL(&imageURL, score)
		case "twitter:description":
			generic.setDescription(&content, score)
		case "application-name":
			generic.setSiteName(content, defaultScore)
		case "description":
			generic.setDescription(&content, defaultScore)
		case "pubdate":
			s.setAndParsePubTime(ctx, content, generic, defaultScore)
		case "lastmod":
			s.setAndParsePubTime(ctx, content, generic, defaultScore)
		}
	})

	// scrape title
	c.OnHTML("head title", func(e *colly.HTMLElement) {
		generic.setTitle(e.Text, defaultScore)
	})

	// scrape favicon
	c.OnHTML("head link[rel][href]", func(e *colly.HTMLElement) {
		rel := strings.ToLower(e.Attr("rel"))
		if strings.Contains(rel, "shortcut icon") ||
			(strings.Contains(rel, "icon") && e.Attr("type") == "image/x-icon") ||
			strings.Contains(rel, "apple-touch-icon") {
			faviconURL := fullURL(hostname, e.Attr("href"))
			generic.setFaviconURL(&faviconURL, defaultScore)
		}
	})

	if err := c.Visit(uri); err != nil {
		return res, err
	}
	return chat1.NewUnfurlRawWithGeneric(generic.UnfurlGenericRaw), nil
}
