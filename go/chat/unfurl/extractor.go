package unfurl

import (
	"context"
	"regexp"

	"github.com/mvdan/xurls"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/logger"
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

	urlRegexp   *regexp.Regexp
	quoteRegexp *regexp.Regexp
	maxHits     int
}

func NewExtractor(log logger.Logger) *Extractor {
	return &Extractor{
		DebugLabeler: utils.NewDebugLabeler(log, "Extractor", false),
		urlRegexp:    xurls.Strict(),
		quoteRegexp:  regexp.MustCompile("`[^`]*`"),
		maxHits:      5,
	}
}

func (e *Extractor) isWhitelistHit(ctx context.Context, hit string, whitelist map[string]bool) bool {
	domain, err := GetDomain(hit)
	if err != nil {
		e.Debug(ctx, "isWhitelistHit: failed to get domain: %s", err)
		return false
	}
	return whitelist[domain]
}

func (e *Extractor) Extract(ctx context.Context, uid gregor1.UID, body string, userSettings *Settings) (res []ExtractorHit, err error) {
	defer e.Trace(ctx, func() error { return err }, "Extract")()
	settings, err := userSettings.Get(ctx, uid)
	if err != nil {
		return res, err
	}
	if settings.Mode == chat1.UnfurlMode_NEVER {
		return res, nil
	}
	body = e.quoteRegexp.ReplaceAllString(body, "")
	hits := e.urlRegexp.FindAllString(body, -1)
	for _, h := range hits {
		ehit := ExtractorHit{
			URL: h,
			Typ: ExtractorHitPrompt,
		}
		switch settings.Mode {
		case chat1.UnfurlMode_ALWAYS:
			ehit.Typ = ExtractorHitUnfurl
		case chat1.UnfurlMode_WHITELISTED:
			if e.isWhitelistHit(ctx, h, settings.Whitelist) {
				ehit.Typ = ExtractorHitUnfurl
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
