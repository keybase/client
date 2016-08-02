// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Twitter
//

type TwitterChecker struct {
	proof RemoteProofChainLink
}

func NewTwitterChecker(p RemoteProofChainLink) (*TwitterChecker, ProofError) {
	return &TwitterChecker{p}, nil
}

func (rc *TwitterChecker) GetTorError() ProofError { return nil }

func (rc *TwitterChecker) CheckHint(g *GlobalContext, h SigHint) ProofError {
	wantedURL := ("https://twitter.com/" + strings.ToLower(rc.proof.GetRemoteUsername()) + "/")
	wantedShortID := (" " + rc.proof.GetSigID().ToShortID() + " /")

	if !strings.HasPrefix(strings.ToLower(h.apiURL), wantedURL) {
		return NewProofError(keybase1.ProofStatus_BAD_API_URL,
			"Bad hint from server; URL should start with '%s'", wantedURL)
	}

	if !strings.Contains(h.checkText, wantedShortID) {
		return NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad proof-check text from server; need '%s' as a substring", wantedShortID)
	}

	return nil
}

func (rc *TwitterChecker) ScreenNameCompare(s1, s2 string) bool {
	return Cicmp(s1, s2)
}

func (rc *TwitterChecker) findSigInTweet(g *GlobalContext, h SigHint, s *goquery.Selection) ProofError {

	inside := s.Text()
	html, err := s.Html()

	checkText := h.checkText

	if err != nil {
		return NewProofError(keybase1.ProofStatus_CONTENT_FAILURE, "No HTML tweet found: %s", err)
	}

	g.Log.Debug("+ Checking tweet '%s' for signature '%s'", inside, checkText)
	g.Log.Debug("| HTML is: %s", html)

	rxx := regexp.MustCompile(`^(@[a-zA-Z0-9_-]+\s+)`)
	for {
		if m := rxx.FindStringSubmatchIndex(inside); m == nil {
			break
		} else {
			prefix := inside[m[2]:m[3]]
			inside = inside[m[3]:]
			g.Log.Debug("| Stripping off @prefx: %s", prefix)
		}
	}
	inside = WhitespaceNormalize(inside)
	checkText = WhitespaceNormalize(checkText)
	if strings.HasPrefix(inside, checkText) {
		return nil
	}

	return NewProofError(keybase1.ProofStatus_DELETED, "Could not find '%s' in '%s'",
		checkText, inside)
}

func (rc *TwitterChecker) CheckStatus(g *GlobalContext, h SigHint) ProofError {
	res, err := g.XAPI.GetHTML(NewAPIArg(g, h.apiURL))
	if err != nil {
		return XapiError(err, h.apiURL)
	}
	csssel := "div.permalink-tweet-container div.permalink-tweet"
	div := res.GoQuery.Find(csssel)
	if div.Length() == 0 {
		return NewProofError(keybase1.ProofStatus_FAILED_PARSE, "Couldn't find a div $(%s)", csssel)
	}

	// Only consider the first
	div = div.First()

	author, ok := div.Attr("data-screen-name")
	if !ok {
		return NewProofError(keybase1.ProofStatus_BAD_USERNAME, "Username not found in DOM")
	}
	wanted := rc.proof.GetRemoteUsername()
	if !rc.ScreenNameCompare(wanted, author) {
		return NewProofError(keybase1.ProofStatus_BAD_USERNAME,
			"Bad post authored; wanted %q but got %q", wanted, author)
	}
	p := div.Find("p.tweet-text")
	if p.Length() == 0 {
		return NewProofError(keybase1.ProofStatus_CONTENT_MISSING,
			"Missing <div class='tweet-text'> container for tweet")
	}

	return rc.findSigInTweet(g, h, p.First())
}

//
//=============================================================================

type TwitterServiceType struct{ BaseServiceType }

func (t TwitterServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var twitterUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9_]{1,20})$`)

func (t TwitterServiceType) NormalizeUsername(s string) (string, error) {
	if !twitterUsernameRegexp.MatchString(s) {
		return "", BadUsernameError{s}
	}
	return strings.ToLower(s), nil
}

func (t TwitterServiceType) NormalizeRemoteName(g *GlobalContext, s string) (string, error) {
	// Allow a leading '@'.
	s = strings.TrimPrefix(s, "@")
	return t.NormalizeUsername(s)
}

func (t TwitterServiceType) GetPrompt() string {
	return "Your username on Twitter"
}

func (t TwitterServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t TwitterServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please <strong>publicly</strong> tweet the following, and don't delete it:`)
}

func (t TwitterServiceType) DisplayName(un string) string { return "Twitter" }
func (t TwitterServiceType) GetTypeName() string          { return "twitter" }

func (t TwitterServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *Markup, err error) {
	if status == keybase1.ProofStatus_PERMISSION_DENIED {
		warning = FmtMarkup("Permission denied! We can't support <strong>private</strong> feeds.")
	} else {
		warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	}
	return
}
func (t TwitterServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t TwitterServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextShort(text, id, false)
}

//=============================================================================

func init() {
	RegisterServiceType(TwitterServiceType{})
	RegisterSocialNetwork("twitter")
	RegisterMakeProofCheckerFunc("twitter",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewTwitterChecker(l)
		})
}

//=============================================================================
