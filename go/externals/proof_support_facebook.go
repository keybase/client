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

func (rc *FacebookChecker) CheckStatus(ctx libkb.ProofContext, h libkb.SigHint, _ libkb.ProofCheckerMode) libkb.ProofError {
	return CheckProofPvl(ctx, keybase1.ProofType_FACEBOOK, rc.proof, h)
}

//
//=============================================================================

type FacebookServiceType struct{ libkb.BaseServiceType }

func (t FacebookServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var facebookUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9.]{1,50})$`)

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
