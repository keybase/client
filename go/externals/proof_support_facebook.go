// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// When we delete this, also delete IsDevelOnly() below.
// +build !production

package externals

import (
	"fmt"
	"net/url"
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
	if pvl.UsePvl {
		// checking the hint is done later in CheckStatus
		return nil
	}

	wantedURL := ("https://m.facebook.com/" + strings.ToLower(rc.proof.GetRemoteUsername()) + "/posts/")
	wantedMediumID := "on Keybase.io. " + rc.proof.GetSigID().ToMediumID()

	if !strings.HasPrefix(strings.ToLower(h.GetAPIURL()), wantedURL) {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_API_URL,
			"Bad hint from server; URL should start with '%s', received '%s'", wantedURL, h.GetAPIURL())
	}

	// TODO: We could ignore this portion of the server's hint. Should we?
	if !strings.Contains(h.GetCheckText(), wantedMediumID) {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad proof-check text from server; need '%s' as a substring, received '%s'", wantedMediumID, h.GetCheckText())
	}

	return nil
}

func (rc *FacebookChecker) ScreenNameCompare(s1, s2 string) bool {
	return normalizeUsername(s1) == normalizeUsername(s2)
}

func (rc *FacebookChecker) CheckStatus(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	if pvl.UsePvl {
		return pvl.CheckProof(ctx, pvl.GetHardcodedPvlString(), keybase1.ProofType_FACEBOOK, pvl.NewProofInfo(rc.proof, h))
	}
	return rc.CheckStatusOld(ctx, h)
}

func (rc *FacebookChecker) CheckStatusOld(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	apiURL := h.GetAPIURL()
	res, err := ctx.GetExternalAPI().GetHTML(libkb.NewAPIArg(apiURL))
	if err != nil {
		return libkb.XapiError(err, apiURL)
	}

	username, proofErr := extractUsername(res.GoQuery)
	if proofErr != nil {
		return proofErr
	}

	if !rc.ScreenNameCompare(username, rc.proof.GetRemoteUsername()) {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_USERNAME, "Usernames don't match: '%s' != '%s'", username, rc.proof.GetRemoteUsername())
	}

	proofText, proofErr := extractProofText(res.GoQuery)
	if proofErr != nil {
		return proofErr
	}

	if strings.TrimSpace(proofText) != strings.TrimSpace(h.GetCheckText()) {
		return libkb.NewProofError(keybase1.ProofStatus_TEXT_NOT_FOUND, "Proof text not found: '%s' != '%s'", proofText, h.GetCheckText())
	}

	// The proof is good.
	return nil
}

const PostHeadersSelector = "#m_story_permalink_view > div:first-child > div:first-child > div:first-child h3"

func extractUsername(doc *goquery.Document) (string, libkb.ProofError) {
	// Get the anchor tag from inside the first header.
	usernameAnchor := doc.Find(PostHeadersSelector).Eq(0).Find("a")
	if usernameAnchor.Length() == 0 {
		return "", libkb.NewProofError(keybase1.ProofStatus_FAILED_PARSE, "Couldn't find username anchor tag")
	}
	// Only consider the first
	usernameAnchor = usernameAnchor.First()

	usernameLink, ok := usernameAnchor.Attr("href")
	if !ok {
		return "", libkb.NewProofError(keybase1.ProofStatus_FAILED_PARSE, "Couldn't find username href.")
	}

	parsedLink, err := url.Parse(usernameLink)
	if err != nil {
		return "", libkb.NewProofError(keybase1.ProofStatus_FAILED_PARSE, "Failed to parse username URL: %s", err)
	}
	splitPath := strings.Split(parsedLink.Path, "/")
	if len(splitPath) < 1 {
		return "", libkb.NewProofError(keybase1.ProofStatus_FAILED_PARSE, "Username URL has no path.")
	}
	username := splitPath[1]
	return username, nil
}

func extractProofText(doc *goquery.Document) (string, libkb.ProofError) {
	// Get the second header.
	proofHeader := doc.Find(PostHeadersSelector).Eq(1)
	if proofHeader.Length() == 0 {
		return "", libkb.NewProofError(keybase1.ProofStatus_FAILED_PARSE, "Couldn't find proof text header")
	}
	return proofHeader.Text(), nil
}

func normalizeUsername(username string) string {
	// Convert to lowercase and strip out dots.
	return strings.ToLower(strings.Replace(username, ".", "", -1))
}

//
//=============================================================================

type FacebookServiceType struct{ libkb.BaseServiceType }

func (t FacebookServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var facebookUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9.]{5,50})$`)

func (t FacebookServiceType) NormalizeUsername(s string) (string, error) {
	if !facebookUsernameRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	return normalizeUsername(s), nil
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
	return libkb.FmtMarkup(
		`<p>Please follow this link and make a <strong>public</strong> Facebook post.</p>
		 <p>The text can be whatever you want, but the post <strong>must be public</strong>.</p>`)
}

func (t FacebookServiceType) DisplayName(un string) string { return "Facebook" }
func (t FacebookServiceType) GetTypeName() string          { return "facebook" }

func (t FacebookServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	if status == keybase1.ProofStatus_PERMISSION_DENIED {
		warning = libkb.FmtMarkup("Permission denied! We can't support <strong>private</strong> posts.")
	} else {
		warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	}
	return
}
func (t FacebookServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t FacebookServiceType) CheckProofText(text string, id keybase1.SigID, sig string) error {
	// In this case the "proof" is a link to a Facebook post dialog, with the
	// actual (short, Twitter-style) proof text in the "name" query parameter.
	parsedURL, err := url.Parse(text)
	if err != nil {
		return err
	}
	nameParams := parsedURL.Query()["name"]
	if len(nameParams) != 1 {
		return libkb.BadSigError{E: fmt.Sprintf("Expected 1 'name' param, found %d", len(nameParams))}
	}
	name := nameParams[0]
	err = t.BaseCheckProofTextShort(name, id, true /* med */)
	if err != nil {
		return err
	}
	// Sanity check other parts of the URL.
	if parsedURL.Scheme != "https" {
		return libkb.BadSigError{E: fmt.Sprintf("Expected HTTPS, found %s", parsedURL.Scheme)}
	}
	if parsedURL.Host != "facebook.com" {
		return libkb.BadSigError{E: fmt.Sprintf("Expected facebook.com, found %s", parsedURL.Host)}
	}
	if parsedURL.Path != "/dialog/feed" {
		return libkb.BadSigError{E: fmt.Sprintf("Unexpected path: %s", parsedURL.Path)}
	}
	return nil
}

func (t FacebookServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &FacebookChecker{l}
}

// When we delete this, also delete the build directive above.
func (t FacebookServiceType) IsDevelOnly() bool { return true }

//=============================================================================

func init() {
	externalServices.Register(FacebookServiceType{})
}

//=============================================================================
