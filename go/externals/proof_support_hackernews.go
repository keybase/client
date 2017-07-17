// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"regexp"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// HackerNews
//

type HackerNewsChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*HackerNewsChecker)(nil)

func (h *HackerNewsChecker) GetTorError() libkb.ProofError { return nil }

func NewHackerNewsChecker(p libkb.RemoteProofChainLink) (*HackerNewsChecker, libkb.ProofError) {
	return &HackerNewsChecker{p}, nil
}

func (h *HackerNewsChecker) CheckStatus(ctx libkb.ProofContext, hint libkb.SigHint, _ libkb.ProofCheckerMode, pvlU libkb.PvlUnparsed) libkb.ProofError {
	return CheckProofPvl(ctx, keybase1.ProofType_HACKERNEWS, h.proof, hint, pvlU)
}

//=============================================================================

func APIBase(un string) string {
	return "https://hacker-news.firebaseio.com/v0/user/" + un
}

func KarmaURL(un string) string {
	return APIBase(un) + "/karma.json"
}

func CheckKarma(ctx libkb.ProofContext, un string) (int, error) {
	u := KarmaURL(un)
	res, err := ctx.GetExternalAPI().Get(libkb.NewAPIArgWithNetContext(ctx.GetNetContext(), u))
	if err != nil {
		return 0, libkb.XapiError(err, u)
	}
	return res.Body.GetInt()
}

//=============================================================================

type HackerNewsServiceType struct{ libkb.BaseServiceType }

func (t HackerNewsServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var hackerNewsUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9_-]{2,15})$`)

func (t HackerNewsServiceType) NormalizeUsername(s string) (string, error) {
	if !hackerNewsUsernameRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	// HackerNews names are case-sensitive
	return s, nil
}

func (t HackerNewsServiceType) NormalizeRemoteName(ctx libkb.ProofContext, s string) (string, error) {
	// Allow a leading '@'.
	s = strings.TrimPrefix(s, "@")
	return t.NormalizeUsername(s)
}

func (t HackerNewsServiceType) GetPrompt() string {
	return "Your username on HackerNews (**case-sensitive**)"
}

func (t HackerNewsServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t HackerNewsServiceType) PostInstructions(un string) *libkb.Markup {
	return libkb.FmtMarkup(`Please edit your HackerNews profile to contain the
following text. Click here: https://news.ycombinator.com/user?id=` + un)
}

func (t HackerNewsServiceType) DisplayName(un string) string { return "HackerNews" }
func (t HackerNewsServiceType) GetTypeName() string          { return "hackernews" }

func (t HackerNewsServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	warning = libkb.FmtMarkup(`<p>We couldn't find a posted proof...<strong>yet</strong></p>`)
	if tryNumber < 3 {
		warning.Append(`<p>HackerNews's API is slow to update, so be patient...try again?</p>`)
	} else {
		warning.Append(`<p>We'll keep trying and let you know.</p>`)
		err = libkb.WaitForItError{}
	}
	return
}
func (t HackerNewsServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t HackerNewsServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofForURL(text, id)
}

func (t HackerNewsServiceType) PreProofCheck(ctx libkb.ProofContext, un string) (markup *libkb.Markup, err error) {
	if _, e := CheckKarma(ctx, un); e != nil {
		markup = libkb.FmtMarkup(`
<p><strong>ATTENTION</strong>: HackerNews only publishes users to their API who
 have <strong>karma &gt; 1</strong>.</p>
<p>Your account <strong>` + un + `</strong> doesn't qualify or doesn't exist.</p>`)
		if e != nil {
			ctx.GetLog().Debug("Error from HN: %s", e)
		}
		err = libkb.NewInsufficientKarmaError(un)
	}
	return
}

func (t HackerNewsServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &HackerNewsChecker{l}
}

//=============================================================================

func init() {
	externalServices.Register(HackerNewsServiceType{})
}

//=============================================================================
