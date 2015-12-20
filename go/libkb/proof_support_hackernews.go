// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"regexp"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// HackerNews
//

type HackerNewsChecker struct {
	proof RemoteProofChainLink
}

func (h *HackerNewsChecker) GetTorError() ProofError { return nil }

func APIBase(un string) string {
	return "https://hacker-news.firebaseio.com/v0/user/" + un
}
func (h *HackerNewsChecker) APIBase() string {
	return APIBase(h.proof.GetRemoteUsername())
}
func (h *HackerNewsChecker) APIURL() string {
	return h.APIBase() + "/about.json"
}
func KarmaURL(un string) string {
	return APIBase(un) + "/karma.json"
}

func (h *HackerNewsChecker) KarmaURL() string {
	return KarmaURL(h.proof.GetRemoteUsername())
}

func (h *HackerNewsChecker) HumanURL() string {
	return "https://news.ycombinator.com/user?id=" + h.proof.GetRemoteUsername()
}

func NewHackerNewsChecker(p RemoteProofChainLink) (*HackerNewsChecker, ProofError) {
	return &HackerNewsChecker{p}, nil
}

func (h *HackerNewsChecker) CheckHint(hint SigHint) ProofError {
	wanted := h.APIURL()
	if Cicmp(wanted, hint.apiURL) {
		return nil
	}

	return NewProofError(keybase1.ProofStatus_BAD_API_URL, "Bad hint from server; URL should start with '%s'", wanted)
}

func (h *HackerNewsChecker) CheckStatus(hint SigHint) ProofError {
	res, err := G.XAPI.GetText(APIArg{
		Endpoint:    hint.apiURL,
		NeedSession: false,
	})
	if err != nil {
		return XapiError(err, hint.apiURL)
	}

	var sigID keybase1.SigID
	_, sigID, err = OpenSig(h.proof.GetArmoredSig())
	var ret ProofError

	if err != nil {
		return NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %s", err)
	}

	wanted := sigID.ToMediumID()
	G.Log.Debug("| HackerNews profile: %s", res.Body)
	G.Log.Debug("| Wanted signature hash: %s", wanted)
	if !strings.Contains(res.Body, wanted) {
		ret = NewProofError(keybase1.ProofStatus_TEXT_NOT_FOUND,
			"Posted text does not include signature '%s'", wanted)
	}

	return ret
}

func CheckKarma(un string) (int, error) {
	u := KarmaURL(un)
	res, err := G.XAPI.Get(APIArg{Endpoint: u, NeedSession: false})
	if err != nil {
		return 0, XapiError(err, u)
	}
	return res.Body.GetInt()
}

//
//=============================================================================

type HackerNewsServiceType struct{ BaseServiceType }

func (t HackerNewsServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

func (t HackerNewsServiceType) CheckUsername(s string) (err error) {
	if !regexp.MustCompile(`^@?(?i:[a-z0-9_-]{2,15})$`).MatchString(s) {
		err = BadUsernameError{s}
	}
	return
}

// HackerNews names are case-sensitive
func (t HackerNewsServiceType) NormalizeUsername(s string) (string, error) {
	return s, nil
}

func (t HackerNewsServiceType) ToChecker() Checker {
	return t.BaseToChecker(t, "alphanumeric, 2 to 15 characters")
}

func (t HackerNewsServiceType) GetPrompt() string {
	return "Your username on HackerNews (**case-sensitive**)"
}

func (t HackerNewsServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t HackerNewsServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please edit your HackerNews profile to contain the
following text. Click here: https://news.ycombinator.com/user?id=` + un)
}

func (t HackerNewsServiceType) DisplayName(un string) string { return "HackerNews" }
func (t HackerNewsServiceType) GetTypeName() string          { return "hackernews" }

func (t HackerNewsServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *Markup, err error) {
	warning = FmtMarkup(`<p>We couldn't find a posted proof...<strong>yet</strong></p>`)
	if tryNumber < 3 {
		warning.Append(`<p>HackerNews's API is slow to update, so be patient...try again?</p>`)
	} else {
		warning.Append(`<p>We'll keep trying and let you know.</p>`)
		err = WaitForItError{}
	}
	return
}
func (t HackerNewsServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t HackerNewsServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofForURL(text, id)
}

func (t HackerNewsServiceType) PreProofCheck(un string) (markup *Markup, err error) {
	if _, e := CheckKarma(un); e != nil {
		markup = FmtMarkup(`
<p><strong>ATTENTION</strong>: HackerNews only publishes users to their API who
 have <strong>karma &gt; 1</strong>.</p>
<p>Your account <strong>` + un + `</strong> doesn't qualify or doesn't exist.</p>`)
		if e != nil {
			G.Log.Debug("Error from HN: %s", e)
		}
		err = InsufficientKarmaError{un}
	}
	return
}

//=============================================================================

func init() {
	RegisterServiceType(HackerNewsServiceType{})
	RegisterSocialNetwork("hackernews")
	RegisterMakeProofCheckerFunc("hackernews",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewHackerNewsChecker(l)
		})
}

//=============================================================================
