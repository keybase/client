// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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

func (rc *FacebookChecker) CheckStatus(mctx libkb.MetaContext, h libkb.SigHint, _ libkb.ProofCheckerMode,
	pvlU keybase1.MerkleStoreEntry) (*libkb.SigHint, libkb.ProofError) {
	// TODO CORE-8951 see if we can populate verifiedHint with anything useful.
	return nil, CheckProofPvl(mctx, keybase1.ProofType_FACEBOOK, rc.proof, h, pvlU)
}

//
//=============================================================================

type FacebookServiceType struct{ libkb.BaseServiceType }

func (t *FacebookServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var facebookUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9.]{1,50})$`)

func (t *FacebookServiceType) NormalizeUsername(s string) (string, error) {
	if !facebookUsernameRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	// Convert to lowercase. Don't strip out dots, because while Facebook makes
	// them optional, there are still dots in a user's "canonical" account name.
	return strings.ToLower(s), nil
}

func (t *FacebookServiceType) NormalizeRemoteName(mctx libkb.MetaContext, s string) (string, error) {
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

func (t *FacebookServiceType) GetPrompt() string {
	return "Your username on Facebook"
}

// TODO remove this in favor of server flag when server configs are enabled
// with CORE-8969
func (t *FacebookServiceType) CanMakeNewProofs() bool { return false }

func (t *FacebookServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t *FacebookServiceType) PostInstructions(un string) *libkb.Markup {
	return libkb.FmtMarkup(
		`<p>Please follow this link and make a <strong>public</strong> Facebook post.</p>
		 <p>The text can be whatever you want, but the post <strong>must be public</strong>.</p>`)
}

func (t *FacebookServiceType) DisplayName(un string) string { return "Facebook" }
func (t *FacebookServiceType) GetTypeName() string          { return "facebook" }

func (t *FacebookServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	if status == keybase1.ProofStatus_PERMISSION_DENIED {
		warning = libkb.FmtMarkup("Permission denied! We can't support <strong>private</strong> posts.")
	} else {
		warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	}
	return
}
func (t *FacebookServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t *FacebookServiceType) CheckProofText(text string, id keybase1.SigID, sig string) error {
	// The "proof" here is a Facebook link that the user clicks on to go
	// through a post flow. The exact nature of the link tends to change (e.g.
	// it used to not point to a login interstitial, but now it does), and
	// users are going to need to eyeball the final post in their browsers
	// anyway, so we don't check anything here.
	return nil
}

func (t *FacebookServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &FacebookChecker{l}
}
