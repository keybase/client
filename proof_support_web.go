package libkb

import (
	"strings"
)

//=============================================================================
// Web
//

type WebChecker struct {
	proof RemoteProofChainLink
}

func NewWebChecker(p RemoteProofChainLink) (*WebChecker, ProofError) {
	return &WebChecker{p}, nil
}

func (rc *WebChecker) CheckHint(h SigHint) ProofError {

	files := []string{".well-known/keybase.txt", "keybase.txt"}
	url_base := rc.proof.ToDisplayString()
	their_url := strings.ToLower(h.apiUrl)

	for _, file := range files {
		our_url := url_base + "/" + file
		if our_url == their_url {
			return nil
		}
	}

	return NewProofError(PROOF_BAD_API_URL,
		"Bad hint from server; didn't recognize API url: %s",
		h.apiUrl)

}

func (rc *WebChecker) CheckStatus(h SigHint) ProofError {
	res, err := G.XAPI.GetText(ApiArg{
		Endpoint:    h.apiUrl,
		NeedSession: false,
	})

	if err != nil {
		return XapiError(err, h.apiUrl)
	}

	var ps *ParsedSig
	ps, err = OpenSig(rc.proof.GetArmoredSig())
	var ret ProofError

	if err != nil {
		return NewProofError(PROOF_BAD_SIGNATURE,
			"Bad signature: %s", err.Error())
	}

	if !FindBase64Block(res.Body, ps.SigBody, false) {
		ret = NewProofError(PROOF_TEXT_NOT_FOUND, "signature not found in body")
	}

	return ret
}

//
//=============================================================================

func init() {
	RegisterProofCheckHook("http",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewWebChecker(l)
		})
}

//=============================================================================
