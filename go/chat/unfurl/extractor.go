package unfurl

import (
	"context"
	"regexp"
	"strings"
	"sync"

	"mvdan.cc/xurls/v2"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type ExtractorHitTyp int

const (
	ExtractorHitUnfurl ExtractorHitTyp = iota
	ExtractorHitPrompt
)

type ExtractorHit struct {
	URL string
	Typ ExtractorHitTyp
}

type Extractor struct {
	utils.DebugLabeler

	urlRegexp      *regexp.Regexp
	quoteRegexp    *regexp.Regexp
	maxHits        int
	exemptionsLock sync.Mutex
	exemptions     map[string]*WhitelistExemptionList
}

func NewExtractor(g *globals.Context) *Extractor {
	return &Extractor{
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "Extractor", false),
		urlRegexp:    xurls.Strict(),
		quoteRegexp:  regexp.MustCompile("`[^`]*`"),
		exemptions:   make(map[string]*WhitelistExemptionList),
		maxHits:      5,
	}
}

func (e *Extractor) getExemptionList(uid gregor1.UID) (res *WhitelistExemptionList) {
	e.exemptionsLock.Lock()
	defer e.exemptionsLock.Unlock()
	var ok bool
	res, ok = e.exemptions[uid.String()]
	if !ok {
		res = NewWhitelistExemptionList()
		e.exemptions[uid.String()] = res
	}
	return res
}

func (e *Extractor) isAutoWhitelistFromHit(ctx context.Context, hit string) bool {
	domain, err := GetDomain(hit)
	if err != nil {
		e.Debug(ctx, "isAutoWhitelistFromHit: failed to get domain: %s", err)
		return false
	}
	return isAutoAllowedDomain(domain)
}

func (e *Extractor) Extract(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, body string, userSettings *Settings,
) (res []ExtractorHit, err error) {
	defer e.Trace(ctx, &err, "Extract")()
	body = e.quoteRegexp.ReplaceAllString(body, "")
	hits := e.urlRegexp.FindAllString(body, -1)
	if len(hits) == 0 {
		return res, nil
	}
	settings, err := userSettings.Get(ctx, uid)
	if err != nil {
		return res, err
	}
	for _, h := range hits {
		ehit := ExtractorHit{
			URL: h,
			Typ: ExtractorHitPrompt,
		}
		switch settings.Mode {
		case chat1.UnfurlMode_ALWAYS:
			ehit.Typ = ExtractorHitUnfurl
		case chat1.UnfurlMode_WHITELISTED:
			domain, err := GetDomain(h)
			if err != nil {
				e.Debug(ctx, "Extract: failed to get domain: %s", err)
				break
			}
			if isAutoAllowedDomain(domain) {
				ehit.Typ = ExtractorHitUnfurl
			} else if settings.Blocklist[domain] {
				continue
			} else if settings.Whitelist[domain] {
				ehit.Typ = ExtractorHitUnfurl
			} else if e.getExemptionList(uid).Use(convID, msgID, domain) {
				e.Debug(ctx, "Extract: hit exemption for domain, letting through")
				ehit.Typ = ExtractorHitUnfurl
			}
		case chat1.UnfurlMode_NEVER:
			if e.isAutoWhitelistFromHit(ctx, h) {
				ehit.Typ = ExtractorHitUnfurl
			} else {
				continue
			}
		}
		res = append(res, ehit)
		if len(res) >= e.maxHits {
			e.Debug(ctx, "Extract: max hits reached, aborting")
			break
		}
	}
	return res, nil
}

// ExtractAll returns the distinct http(s) URLs in body as unfurl hits, ignoring the user's
// settings. It is for an explicit request to unfurl one message, which overrides the mode and
// both lists. Unlike Extract it skips schemes that cannot be scraped and counts a repeated URL
// once toward maxHits; the client mirrors both to decide when to offer the request.
func (e *Extractor) ExtractAll(body string) (res []ExtractorHit) {
	body = e.quoteRegexp.ReplaceAllString(body, "")
	seen := make(map[string]bool)
	for _, h := range e.urlRegexp.FindAllString(body, -1) {
		lower := strings.ToLower(h)
		scrapeable := strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://")
		if seen[h] || !scrapeable {
			continue
		}
		seen[h] = true
		res = append(res, ExtractorHit{URL: h, Typ: ExtractorHitUnfurl})
		if len(res) >= e.maxHits {
			break
		}
	}
	return res
}

func (e *Extractor) AddWhitelistExemption(ctx context.Context, uid gregor1.UID,
	exemption types.WhitelistExemption,
) {
	defer e.Trace(ctx, nil, "AddWhitelistExemption")()
	e.getExemptionList(uid).Add(exemption)
}
