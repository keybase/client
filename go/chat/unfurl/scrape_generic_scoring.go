package unfurl

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/colly"
)

// Contents are scored based on source. Higher scores win but falsey values
// always loose.
const (
	defaultScore          = 1
	defaultArticleScore   = 8
	defaultTwitterScore   = 10
	defaultOpenGraphScore = 11
)

type setterType int

const (
	setTitle setterType = iota
	setURL
	setSiteName
	setFaviconURL
	setImageURL
	setPublishTime
	setDescription
	setVideo
)

func getOpenGraphScore(domain string, e *colly.HTMLElement) int {
	switch domain {
	default:
		return defaultOpenGraphScore
	}
}

func getTwitterScore(domain string, e *colly.HTMLElement) int {
	switch domain {
	default:
		return defaultTwitterScore
	}
}

func getArticleScore(domain string, e *colly.HTMLElement) int {
	switch domain {
	default:
		return defaultArticleScore
	}
}

func getDefaultScore(domain string, e *colly.HTMLElement) int {
	return defaultScore
}

func getFaviconMultiplier(e *colly.HTMLElement) int {
	// 192x192
	sizes := strings.Split(e.Attr("sizes"), "x")
	width, err := strconv.Atoi(sizes[0])
	if err != nil {
		return 1
	}
	height, err := strconv.Atoi(sizes[1])
	if err != nil {
		return 1
	}
	return width + height
}

// Favor apple-touch-icon over other favicons, try to get the highest
// resolution.
func getAppleTouchFaviconScore(domain string, e *colly.HTMLElement) int {
	return (getDefaultScore(domain, e) + 1) * getFaviconMultiplier(e)
}

func getAppleTouchFaviconScoreFromPath() int {
	return defaultScore * 384
}

// Metadata to describe how to extra and score content and which field this
// attribute describes
type attrRanker struct {
	content func(e *colly.HTMLElement) []string
	score   func(domain string, e *colly.HTMLElement) int
	setter  setterType
}

func getHrefAttr(e *colly.HTMLElement) []string {
	return []string{e.Attr("href")}
}

func getContentAttr(e *colly.HTMLElement) []string {
	return []string{e.Attr("content")}
}

func getHrefAndContentAttr(e *colly.HTMLElement) []string {
	return append(getHrefAttr(e), getContentAttr(e)...)
}

func getOpenGraphVideo(e *colly.HTMLElement) []string {
	url := e.Attr("content")
	if len(url) == 0 {
		return nil
	}
	mimeType := "video/mp4"
	var height, width *int
	heightStr, _ :=
		e.DOM.SiblingsFiltered("meta[content][property=\"og:video:height\"]").Eq(0).Attr("content")
	if h, err := strconv.Atoi(heightStr); err == nil && h > 0 {
		height = &h
	}
	widthStr, _ := e.DOM.SiblingsFiltered("meta[content][property=\"og:video:width\"]").Eq(0).Attr("content")
	if w, err := strconv.Atoi(widthStr); err == nil && w > 0 {
		width = &w
	}
	typeStr, ok := e.DOM.SiblingsFiltered("meta[content][property=\"og:video:type\"]").Eq(0).Attr("content")
	if ok {
		mimeType = typeStr
	}
	if height == nil || width == nil {
		return nil
	}
	return []string{fmt.Sprintf("%s %d %d %s", url, *height, *width, mimeType)}
}

// Map of supported attributes/tags
var attrRankMap = map[string]attrRanker{
	// title
	"title": attrRanker{
		content: func(e *colly.HTMLElement) []string { return []string{e.Text} },
		score:   getDefaultScore,
		setter:  setTitle,
	},
	"twitter:title": attrRanker{
		content: getContentAttr,
		score:   getTwitterScore,
		setter:  setTitle,
	},
	"og:title": attrRanker{
		content: getContentAttr,
		score:   getOpenGraphScore,
		setter:  setTitle,
	},

	// url
	"og:url": attrRanker{
		content: getContentAttr,
		score:   getOpenGraphScore,
		setter:  setURL,
	},

	// siteName
	"application-name": attrRanker{
		content: getContentAttr,
		score:   getDefaultScore,
		setter:  setSiteName,
	},
	"og:site_name": attrRanker{
		content: getContentAttr,
		score:   getOpenGraphScore,
		setter:  setSiteName,
	},

	// favicon
	"shortcut icon": attrRanker{
		content: getHrefAttr,
		score:   getDefaultScore,
		setter:  setFaviconURL,
	},
	"icon": attrRanker{
		content: getHrefAttr,
		score:   getDefaultScore,
		setter:  setFaviconURL,
	},
	"apple-touch-icon": attrRanker{
		content: getHrefAttr,
		score:   getAppleTouchFaviconScore,
		setter:  setFaviconURL,
	},

	// imageUrl
	"twitter:image": attrRanker{
		content: getHrefAndContentAttr,
		score:   getTwitterScore,
		setter:  setImageURL,
	},
	"og:image": attrRanker{
		content: getHrefAndContentAttr,
		score:   getOpenGraphScore,
		setter:  setImageURL,
	},

	// video
	"og:video": attrRanker{
		content: getOpenGraphVideo,
		score:   getOpenGraphScore,
		setter:  setVideo,
	},

	// publishTime
	"lastmod": attrRanker{
		content: getContentAttr,
		score:   getDefaultScore,
		setter:  setPublishTime,
	},
	"pubdate": attrRanker{
		content: getContentAttr,
		score:   getArticleScore,
		setter:  setPublishTime,
	},
	"og:pubdate": attrRanker{
		content: getContentAttr,
		score:   getOpenGraphScore,
		setter:  setPublishTime,
	},
	"pdate": attrRanker{
		content: getContentAttr,
		score:   getDefaultScore,
		setter:  setPublishTime,
	},
	"article.published": attrRanker{
		content: getContentAttr,
		score:   getArticleScore,
		setter:  setPublishTime,
	},
	"article:published": attrRanker{
		content: getContentAttr,
		score:   getArticleScore,
		setter:  setPublishTime,
	},
	"datePublished": attrRanker{
		content: getContentAttr,
		score:   getArticleScore,
		setter:  setPublishTime,
	},

	// description
	"description": attrRanker{
		content: getContentAttr,
		score:   getDefaultScore,
		setter:  setDescription,
	},
	"twitter:description": attrRanker{
		content: getContentAttr,
		score:   getTwitterScore,
		setter:  setDescription,
	},
	"og:description": attrRanker{
		content: getContentAttr,
		score:   getOpenGraphScore,
		setter:  setDescription,
	},
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
	videoScore       int
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

func (g *scoredGenericRaw) setVideo(videoDesc string, score int) {
	if score > g.videoScore || g.Video == nil {
		parts := strings.Split(videoDesc, " ")
		height, _ := strconv.Atoi(parts[1])
		width, _ := strconv.Atoi(parts[2])
		g.Video = &chat1.UnfurlVideo{
			Url:      parts[0],
			MimeType: parts[3],
			Height:   height,
			Width:    width,
		}
		g.videoScore = score
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
