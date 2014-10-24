package libkb

import (
	"strings"
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

func (rc *CoinbaseChecker) ProfileUrl() string {
	return "https://coinbase.com/" + rc.proof.GetRemoteUsername() + "/public-key"
}

func (rc *CoinbaseChecker) CheckHint(h SigHint) ProofError {
	if wanted := rc.ProfileUrl(); wanted == strings.ToLower(h.apiUrl) {
		return nil
	} else {
		return NewProofError(PROOF_BAD_API_URL,
			"Bad hint from server; URL should be '%s'", wanted)
	}
}

func (rc *CoinbaseChecker) CheckStatus(h SigHint) ProofError {
	res, err := G.XAPI.GetHtml(ApiArg{
		Endpoint:    h.apiUrl,
		NeedSession: false,
	})
	if err != nil {
		return XapiError(err, h.apiUrl)
	}
	csssel := "div#public_key_content pre.statement"
	div := res.GoQuery.Find(csssel)
	if div.Length() == 0 {
		return NewProofError(PROOF_FAILED_PARSE, "Couldn't find a div $(%s)", csssel)
	}

	// Only consider the first
	div = div.First()

	var ret ProofError

	if html, err := div.Html(); err != nil {
		ret = NewProofError(PROOF_CONTENT_MISSING,
			"Missing proof HTML content: %s", err.Error())
	} else if ps, err := OpenSig(rc.proof.GetArmoredSig()); err != nil {
		ret = NewProofError(PROOF_BAD_SIGNATURE,
			"Bad signature: %s", err.Error())
	} else if !FindBase64Block(html, ps.SigBody, false) {
		ret = NewProofError(PROOF_TEXT_NOT_FOUND, "signature not found in body")
	}

	return ret
}

//
//=============================================================================

func init() {
	RegisterProofCheckHook("coinbase",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewCoinbaseChecker(l)
		})
}

//=============================================================================
