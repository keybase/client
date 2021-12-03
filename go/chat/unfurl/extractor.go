package unfurl

import (
	"context"
	"regexp"
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

func (e *Extractor) isAutoWhitelist(domain string) bool {
	switch domain {
	case "giphy.com", types.MapsDomain:
		return true
	}
	return false
}

func (e *Extractor) isAutoWhitelistFromHit(ctx context.Context, hit string) bool {
	domain, err := GetDomain(hit)
	if err != nil {
		e.Debug(ctx, "isAutoWhitelistFromHit: failed to get domain: %s", err)
		return false
	}
	return e.isAutoWhitelist(domain)
}

func (e *Extractor) isWhitelistHit(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID,
	hit string, whitelist map[string]bool, exemptions *WhitelistExemptionList) bool {
	domain, err := GetDomain(hit)
	if err != nil {
		e.Debug(ctx, "isWhitelistHit: failed to get domain: %s", err)
		return false
	}
	if e.isAutoWhitelist(domain) || whitelist[domain] {
		return true
	}
	// Check exemptions
	if exemptions.Use(convID, msgID, domain) {
		e.Debug(ctx, "isWhitelistHit: hit exemption for domain, letting through")
		return true
	}
	return false
}

func (e *Extractor) Extract(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, body string, userSettings *Settings) (res []ExtractorHit, err error) {
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
			if e.isWhitelistHit(ctx, convID, msgID, h, settings.Whitelist, e.getExemptionList(uid)) {
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

func (e *Extractor) AddWhitelistExemption(ctx context.Context, uid gregor1.UID,
	exemption types.WhitelistExemption) {
	defer e.Trace(ctx, nil, "AddWhitelistExemption")()
	e.getExemptionList(uid).Add(exemption)
}
