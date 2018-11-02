package unfurl

import (
	"context"
	"regexp"

	"github.com/mvdan/xurls"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
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

	urlRegexp *regexp.Regexp
}

func NewExtractor(log logger.Logger) *Extractor {
	return &Extractor{
		DebugLabeler: utils.NewDebugLabeler(log, "Extractor", false),
		urlRegexp:    xurls.Strict(),
	}
}

func (e *Extractor) Extract(ctx context.Context, body string, userSettings *Settings) (res []ExtractorHit, err error) {
	defer e.Trace(ctx, func() error { return err }, "Extract")()
	settings, err := userSettings.Get(ctx)
	if err != nil {
		return res, err
	}
	if settings.Mode == chat1.UnfurlMode_NEVER {
		return res, nil
	}
	hits := e.urlRegexp.FindAllString(body, -1)
	if settings.Mode == chat1.UnfurlMode_ALWAYS {
		for _, h := range hits {
			res = append(res, ExtractorHit{
				URL: h,
				Typ: ExtractorHitUnfurl,
			})
		}
		return res, nil
	}
}
