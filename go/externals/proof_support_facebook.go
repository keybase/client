// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	pvl "github.com/keybase/client/go/pvl"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Facebook
//

type FacebookChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*FacebookChecker)(nil)

func NewFacebookChecker(p libkb.RemoteProofChainLink) (*FacebookChecker, libkb.ProofError) {
	return &FacebookChecker{p}, nil
}

func (rc *FacebookChecker) GetTorError() libkb.ProofError { return nil }

func (rc *FacebookChecker) CheckHint(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	wantedURL := ("https://m.facebook.com/" + strings.ToLower(rc.proof.GetRemoteUsername()) + "/posts/")
	wantedMediumID := "on Keybase.io. " + rc.proof.GetSigID().ToMediumID()

	if !strings.HasPrefix(strings.ToLower(h.GetAPIURL()), wantedURL) {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_API_URL,
			"Bad hint from server; URL should start with '%s'", wantedURL)
	}

	// TODO: We could ignore this portion of the server's hint. Should we?
	if !strings.Contains(h.GetCheckText(), wantedMediumID) {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad proof-check text from server; need '%s' as a substring", wantedMediumID)
	}

	return nil
}

func (rc *FacebookChecker) ScreenNameCompare(s1, s2 string) bool {
	s1NoDots := strings.Replace(s1, ".", "", -1)
	s2NoDots := strings.Replace(s2, ".", "", -1)
	return libkb.Cicmp(s1NoDots, s2NoDots)
}

func (rc *FacebookChecker) findSigInPost(ctx libkb.ProofContext, h libkb.SigHint, s *goquery.Selection) libkb.ProofError {

	inside := s.Text()
	html, err := s.Html()

	checkText := h.GetCheckText()

	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE, "No HTML post found: %s", err)
	}

	ctx.GetLog().Debug("+ Checking post '%s' for signature '%s'", inside, checkText)
	ctx.GetLog().Debug("| HTML is: %s", html)

	rxx := regexp.MustCompile(`^(@[a-zA-Z0-9_-]+\s+)`)
	for {
		if m := rxx.FindStringSubmatchIndex(inside); m == nil {
			break
		} else {
			prefix := inside[m[2]:m[3]]
			inside = inside[m[3]:]
			ctx.GetLog().Debug("| Stripping off @prefx: %s", prefix)
		}
	}
	inside = libkb.WhitespaceNormalize(inside)
	checkText = libkb.WhitespaceNormalize(checkText)
	if strings.HasPrefix(inside, checkText) {
		return nil
	}

	return libkb.NewProofError(keybase1.ProofStatus_DELETED, "Could not find '%s' in '%s'",
		checkText, inside)
}

func (rc *FacebookChecker) CheckStatus(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	if pvl.UsePvl {
		return pvl.CheckProof(ctx, pvl.GetHardcodedPvl(), keybase1.ProofType_FACEBOOK, rc.proof, h)
	}
	return rc.CheckStatusOld(ctx, h)
}

func (rc *FacebookChecker) CheckStatusOld(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	url := h.GetAPIURL()
	res, err := ctx.GetExternalAPI().GetHTML(libkb.NewAPIArg(url))
	if err != nil {
		return libkb.XapiError(err, url)
	}
	csssel := "div.permalink-tweet-container div.permalink-tweet"
	div := res.GoQuery.Find(csssel)
	if div.Length() == 0 {
		return libkb.NewProofError(keybase1.ProofStatus_FAILED_PARSE, "Couldn't find a div $(%s)", csssel)
	}

	// Only consider the first
	div = div.First()

	author, ok := div.Attr("data-screen-name")
	if !ok {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_USERNAME, "Username not found in DOM")
	}
	wanted := rc.proof.GetRemoteUsername()
	if !rc.ScreenNameCompare(wanted, author) {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_USERNAME,
			"Bad post authored; wanted %q but got %q", wanted, author)
	}
	p := div.Find("p.tweet-text")
	if p.Length() == 0 {
		return libkb.NewProofError(keybase1.ProofStatus_CONTENT_MISSING,
			"Missing <div class='tweet-text'> container for post")
	}

	return rc.findSigInPost(ctx, h, p.First())
}

//
//=============================================================================

type FacebookServiceType struct{ libkb.BaseServiceType }

func (t FacebookServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var facebookUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9_]{1,20})$`)

func (t FacebookServiceType) NormalizeUsername(s string) (string, error) {
	if !facebookUsernameRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	return strings.ToLower(s), nil
}

func (t FacebookServiceType) NormalizeRemoteName(ctx libkb.ProofContext, s string) (string, error) {
	// Allow a leading '@'.
	s = strings.TrimPrefix(s, "@")
	return t.NormalizeUsername(s)
}

func (t FacebookServiceType) GetPrompt() string {
	return "Your username on Facebook"
}

func (t FacebookServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t FacebookServiceType) PostInstructions(un string) *libkb.Markup {
	return libkb.FmtMarkup(`Please <strong>publicly</strong> post the following, and don't delete it:`)
}

func (t FacebookServiceType) DisplayName(un string) string { return "Facebook" }
func (t FacebookServiceType) GetTypeName() string          { return "facebook" }

func (t FacebookServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	if status == keybase1.ProofStatus_PERMISSION_DENIED {
		warning = libkb.FmtMarkup("Permission denied! We can't support <strong>private</strong> feeds.")
	} else {
		warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	}
	return
}
func (t FacebookServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t FacebookServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextShort(text, id, false)
}

func (t FacebookServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &FacebookChecker{l}
}

//=============================================================================

func init() {
	externalServices.Register(FacebookServiceType{})
}

//=============================================================================
