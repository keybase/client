// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"fmt"
	"regexp"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	pvl "github.com/keybase/client/go/pvl"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Coinbase
//

type CoinbaseChecker struct {
	proof libkb.RemoteProofChainLink
}

var _ libkb.ProofChecker = (*CoinbaseChecker)(nil)

func NewCoinbaseChecker(p libkb.RemoteProofChainLink) (*CoinbaseChecker, libkb.ProofError) {
	return &CoinbaseChecker{p}, nil
}

func (rc *CoinbaseChecker) GetTorError() libkb.ProofError { return nil }

func (rc *CoinbaseChecker) CheckStatus(ctx libkb.ProofContext, h libkb.SigHint, _ libkb.ProofCheckerMode) libkb.ProofError {
	return pvl.CheckProof(ctx, pvl.GetHardcodedPvlString(), keybase1.ProofType_COINBASE, pvl.NewProofInfo(rc.proof, h))
}

//
//=============================================================================

type CoinbaseServiceType struct{ libkb.BaseServiceType }

func (t CoinbaseServiceType) AllStringKeys() []string { return t.BaseAllStringKeys(t) }

func coinbaseUserURL(s string) string {
	return "https://coinbase.com/" + s
}

func coinbaseSettingsURL(s string) string {
	return coinbaseUserURL(s) + "#settings"
}

var coinbaseUsernameRegexp = regexp.MustCompile(`^(?i:[a-z0-9_]{2,16})$`)

func (t CoinbaseServiceType) NormalizeUsername(s string) (string, error) {
	if !coinbaseUsernameRegexp.MatchString(s) {
		return "", libkb.NewBadUsernameError(s)
	}
	return strings.ToLower(s), nil
}

func (t CoinbaseServiceType) NormalizeRemoteName(_ libkb.ProofContext, s string) (ret string, err error) {
	// Allow a leading '@'.
	s = strings.TrimPrefix(s, "@")
	return t.NormalizeUsername(s)
}

func (t CoinbaseServiceType) GetPrompt() string {
	return "Your username on Coinbase"
}

func (t CoinbaseServiceType) PreProofCheck(ctx libkb.ProofContext, normalizedUsername string) (*libkb.Markup, error) {
	_, err := ctx.GetExternalAPI().GetHTML(libkb.NewAPIArgWithNetContext(ctx.GetNetContext(), coinbaseUserURL(normalizedUsername)))
	if err != nil {
		if ae, ok := err.(*libkb.APIError); ok && ae.Code == 404 {
			err = libkb.NewProfileNotPublicError(fmt.Sprintf("%s isn't public! Change your settings at %s",
				coinbaseUserURL(normalizedUsername),
				coinbaseSettingsURL(normalizedUsername)))
		}
		return nil, err
	}
	return nil, nil
}

func (t CoinbaseServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t CoinbaseServiceType) PostInstructions(un string) *libkb.Markup {
	return libkb.FmtMarkup(`Please update your Coinbase profile to show this proof.
Click here: ` + coinbaseSettingsURL(un))

}

func (t CoinbaseServiceType) DisplayName(un string) string { return "Coinbase" }
func (t CoinbaseServiceType) GetTypeName() string          { return "coinbase" }

func (t CoinbaseServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *libkb.Markup, err error) {
	warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	return
}
func (t CoinbaseServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t CoinbaseServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextFull(text, id, sig)
}

func (t CoinbaseServiceType) MakeProofChecker(l libkb.RemoteProofChainLink) libkb.ProofChecker {
	return &CoinbaseChecker{l}
}

//=============================================================================

func init() {
	externalServices.Register(CoinbaseServiceType{})
}

//=============================================================================
