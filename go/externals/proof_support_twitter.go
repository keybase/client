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
// Twitter
//

type TwitterChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*TwitterChecker)(nil)

func NewTwitterChecker(p libkb.RemoteProofChainLink) (*TwitterChecker, libkb.ProofError) {
	return &TwitterChecker{p}, nil
}

func (rc *TwitterChecker) GetTorError() libkb.ProofError { return nil }

func (rc *TwitterChecker) CheckStatus(ctx libkb.ProofContext, h libkb.SigHint, _ libkb.ProofCheckerMode, pvlU libkb.PvlUnparsed) libkb.ProofError {
	return CheckProofPvl(ctx, keybase1.ProofType_TWITTER, rc.proof, h, pvlU)
}

//
//=============================================================================

type TwitterServiceType struct{ libkb.BaseServiceType }

func (t TwitterServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

var twitterUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9_]{1,20})$`)

func (t TwitterServiceType) NormalizeUsername(s string) (string, error) {
	if !twitterUsernameRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	return strings.ToLower(s), nil
}

func (t TwitterServiceType) NormalizeRemoteName(ctx libkb.ProofContext, s string) (string, error) {
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

func (t TwitterServiceType) PostInstructions(un string) *libkb.Markup {
	return libkb.FmtMarkup(`Please <strong>publicly</strong> tweet the following, and don't delete it:`)
}

func (t TwitterServiceType) DisplayName(un string) string { return "Twitter" }
func (t TwitterServiceType) GetTypeName() string          { return "twitter" }

func (t TwitterServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	if status == keybase1.ProofStatus_PERMISSION_DENIED {
		warning = libkb.FmtMarkup("Permission denied! We can't support <strong>private</strong> feeds.")
	} else {
		warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	}
	return
}
func (t TwitterServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t TwitterServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextShort(text, id, false)
}

func (t TwitterServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &TwitterChecker{l}
}

//=============================================================================

func init() {
	externalServices.Register(TwitterServiceType{})
}

//=============================================================================
