package unfurl

import (
	"context"
	"time"

	"github.com/gocolly/colly"
	"github.com/keybase/client/go/protocol/chat1"
)

func (s *Scraper) scrapeGeneric(ctx context.Context, uri, domain string) (res chat1.Unfurl, err error) {
	var generic chat1.UnfurlGeneric
	hostname, err := GetHostname(uri)
	if err != nil {
		return res, err
	}
	generic.Url = uri
	generic.SiteName = domain
	c := colly.NewCollector(colly.AllowedDomains(hostname))
	c.OnHTML("meta[content][property]", func(e *colly.HTMLElement) {
		prop := e.Attr("property")
		content := e.Attr("content")
		switch prop {
		case "og:description":
			generic.Description = &content
		case "og:image":
			generic.ImageUrl = &content
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
	c.OnHTML("title", func(e *colly.HTMLElement) {
		generic.Title = e.Text
	})
	if err := c.Visit(uri); err != nil {
		return res, err
	}
	return chat1.NewUnfurlWithGeneric(generic), nil
}
