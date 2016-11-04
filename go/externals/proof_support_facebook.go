// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"

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

	hintDesktopURL := makeDesktopURL(h.GetAPIURL())

	// Checking for the correct username is essential here. We rely on this
	// check to prove that the user in question actually wrote the post. (Note
	// that the m-site does *not* enforce this part of the URL. Only the
	// desktop site does.)
	//
	// Facebook usernames don't actually allow any special characters, but it's
	// still possible for a malicious user to *claim* they have some slashes
	// and a question mark in their name, in the hopes that that will trick us
	// into hitting a totally unrelated URL. Guard against that happening by
	// escaping the name.
	urlEscapedUsername := url.QueryEscape(rc.proof.GetRemoteUsername())

	// We build a case-insensitive regex (that's the `(?i)` at the front), but
	// we still want to be very strict about the structure of the whole thing.
	// No query parameters, no unexpected characters in the post ID. Note that
	// if we ever allow non-numeric characters in the post ID, we might want to
	// restrict the case-insensitivity more carefully.
	expectedPrefix := "https://www.facebook.com/" + urlEscapedUsername + "/posts/"
	urlRegex := regexp.MustCompile("(?i)^" + regexp.QuoteMeta(expectedPrefix) + "[0-9]+$")
	if !urlRegex.MatchString(hintDesktopURL) {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_API_URL,
			"Bad Facebook URL hint: %s", hintDesktopURL)
	}

	// We're enforcing almost the exact contents of the proof text here, so in
	// theory we could just ignore the server's hint. However, in the future,
	// if some bug or some change on Facebook's end introduces some
	// variability, we might want more of the server's help. Keeping this
	// validation around will help keep things clean in the meantime.
	checkText := libkb.WhitespaceNormalize(h.GetCheckText())
	re := regexp.MustCompile("^Verifying myself: I am (\\S+) on Keybase.io. (\\S+)$")
	match := re.FindStringSubmatch(checkText)
	wantedCheckText := "Verifying myself: I am " + rc.proof.GetUsername() + " on Keybase.io. " + rc.proof.GetSigID().ToMediumID()
	checkTextErr := libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
		"Bad proof-check text from server; need '%s', received '%s'", wantedCheckText, checkText)
	if len(match) != 3 {
		return checkTextErr
	}
	if !libkb.Cicmp(match[1], rc.proof.GetUsername()) {
		return checkTextErr
	}
	if match[2] != rc.proof.GetSigID().ToMediumID() {
		return checkTextErr
	}

	return nil
}

func (rc *FacebookChecker) CheckStatus(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	if pvl.UsePvl {
		return pvl.CheckProof(ctx, pvl.GetHardcodedPvlString(), keybase1.ProofType_FACEBOOK, pvl.NewProofInfo(rc.proof, h))
	}
	return rc.CheckStatusOld(ctx, h)
}

func (rc *FacebookChecker) CheckStatusOld(ctx libkb.ProofContext, h libkb.SigHint) libkb.ProofError {
	// Previously we would parse markup to extract the username and proof text.
	// We had to switch to the desktop site to validate the usernames of people
	// with the "no search engine scraping" Facebook privacy setting turned on.
	// (Since only the desktop site, and not the m-site, enforces that the
	// author ID in a post URL is correct.) That in turn made it much harder to
	// parse the markup we get, because what we want comes down in an embedded
	// comment. However, because the desktop site (again, unlike the m-site)
	// does not display comments or ads to logged-out users, we can do a simple
	// string match on the whole page to find the proof text. It's possible
	// there's some way I haven't thought of for other users to inject strings
	// somewhere in this page, or break that URL->author relationship, and if
	// so we'll need to change it.

	desktopURL := makeDesktopURL(h.GetAPIURL())

	res, err := ctx.GetExternalAPI().GetText(libkb.NewAPIArg(desktopURL))
	if err != nil {
		return libkb.XapiError(err, desktopURL)
	}

	// We require a tiny bit of structure, which is that the proof must appear
	// as the exact contents of an <a> tag. Again, this is just a textual
	// search -- the <a> tag in question is actually expected to be in a
	// comment.
	escapedProofText := regexp.QuoteMeta(h.GetCheckText())
	proofTextRegex := regexp.MustCompile("<a[^>]*>\\s*" + escapedProofText + "\\s*</a[^>]*>")

	if !proofTextRegex.MatchString(res.Body) {
		errorText := fmt.Sprintf("Couldn't find Facebook proof text at %s. Is it deleted or private?", desktopURL)
		return libkb.NewProofError(keybase1.ProofStatus_FAILED_PARSE, errorText)
	}

	// The proof is good.
	return nil
}

func makeDesktopURL(apiURL string) string {
	mobile := "https://m.facebook.com/"
	desktop := "https://www.facebook.com/"
	if strings.HasPrefix(apiURL, mobile) {
		// Note, only replaces the first occurrence.
		return strings.Replace(apiURL, mobile, desktop, 1)
	}
	return apiURL
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
	// Convert to lowercase and strip out dots.
	return strings.ToLower(strings.Replace(s, ".", "", -1)), nil
}

func (t FacebookServiceType) NormalizeRemoteName(ctx libkb.ProofContext, s string) (string, error) {
	// Allow a leading '@'.
	s = strings.TrimPrefix(s, "@")
	if !facebookUsernameRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	// This is the normalization function that gets called by the Prove engine.
	// Avoid stripping dots, so that we can preserve them when the username is
	// displayed.
	return strings.ToLower(s), nil
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

//=============================================================================

func init() {
	externalServices.Register(FacebookServiceType{})
}

//=============================================================================
