// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"regexp"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

//=============================================================================
// Coinbase
//

type CoinbaseChecker struct {
	proof RemoteProofChainLink
}

func NewCoinbaseChecker(p RemoteProofChainLink) (*CoinbaseChecker, ProofError) {
	return &CoinbaseChecker{p}, nil
}

func (rc *CoinbaseChecker) ProfileURL() string {
	return "https://coinbase.com/" + rc.proof.GetRemoteUsername() + "/public-key"
}

func (rc *CoinbaseChecker) CheckHint(g *GlobalContext, h SigHint) ProofError {
	wanted := rc.ProfileURL()
	if strings.ToLower(wanted) == strings.ToLower(h.apiURL) {
		return nil
	}
	return NewProofError(keybase1.ProofStatus_BAD_API_URL, "Bad hint from server; URL should be %q; got %q", wanted, h.apiURL)
}

func (rc *CoinbaseChecker) GetTorError() ProofError { return nil }

func (rc *CoinbaseChecker) CheckStatus(g *GlobalContext, h SigHint) ProofError {
	res, err := g.XAPI.GetHTML(NewAPIArg(g, h.apiURL))
	if err != nil {
		return XapiError(err, h.apiURL)
	}
	csssel := "pre.statement"
	div := res.GoQuery.Find(csssel)
	if div.Length() == 0 {
		return NewProofError(keybase1.ProofStatus_FAILED_PARSE, "Couldn't find a div $(%s)", csssel)
	}

	// Only consider the first
	div = div.First()

	var ret ProofError

	if html, err := div.Html(); err != nil {
		ret = NewProofError(keybase1.ProofStatus_CONTENT_MISSING,
			"Missing proof HTML content: %s", err)
	} else if sigBody, _, err := OpenSig(rc.proof.GetArmoredSig()); err != nil {
		ret = NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %s", err)
	} else if !FindBase64Block(html, sigBody, false) {
		ret = NewProofError(keybase1.ProofStatus_TEXT_NOT_FOUND, "signature not found in body")
	}

	return ret
}

//
//=============================================================================

type CoinbaseServiceType struct{ BaseServiceType }

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
		return "", BadUsernameError{s}
	}
	return strings.ToLower(s), nil
}

func (t CoinbaseServiceType) NormalizeRemoteName(_ *GlobalContext, s string) (ret string, err error) {
	// Allow a leading '@'.
	s = strings.TrimPrefix(s, "@")
	return t.NormalizeUsername(s)
}

func (t CoinbaseServiceType) GetPrompt() string {
	return "Your username on Coinbase"
}

func (t CoinbaseServiceType) PreProofCheck(g *GlobalContext, normalizedUsername string) (*Markup, error) {
	_, err := g.XAPI.GetHTML(NewAPIArg(g, coinbaseUserURL(normalizedUsername)))
	if err != nil {
		if ae, ok := err.(*APIError); ok && ae.Code == 404 {
			err = ProfileNotPublicError{fmt.Sprintf("%s isn't public! Change your settings at %s",
				coinbaseUserURL(normalizedUsername),
				coinbaseSettingsURL(normalizedUsername))}
		}
		return nil, err
	}
	return nil, nil
}

func (t CoinbaseServiceType) ToServiceJSON(un string) *jsonw.Wrapper {
	return t.BaseToServiceJSON(t, un)
}

func (t CoinbaseServiceType) PostInstructions(un string) *Markup {
	return FmtMarkup(`Please update your Coinbase profile to show this proof.
Click here: ` + coinbaseSettingsURL(un))

}

func (t CoinbaseServiceType) DisplayName(un string) string { return "Coinbase" }
func (t CoinbaseServiceType) GetTypeName() string          { return "coinbase" }

func (t CoinbaseServiceType) RecheckProofPosting(tryNumber int, status keybase1.ProofStatus, _ string) (warning *Markup, err error) {
	warning, err = t.BaseRecheckProofPosting(tryNumber, status)
	return
}
func (t CoinbaseServiceType) GetProofType() string { return t.BaseGetProofType(t) }

func (t CoinbaseServiceType) CheckProofText(text string, id keybase1.SigID, sig string) (err error) {
	return t.BaseCheckProofTextFull(text, id, sig)
}

//=============================================================================

func init() {
	RegisterServiceType(CoinbaseServiceType{})
	RegisterSocialNetwork("coinbase")
	RegisterMakeProofCheckerFunc("coinbase",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewCoinbaseChecker(l)
		})
}

//=============================================================================
