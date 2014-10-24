package libkb

import (
	"strings"
)

//=============================================================================
// Github
//

type GithubChecker struct {
	proof RemoteProofChainLink
}

func NewGithubChecker(p RemoteProofChainLink) (*GithubChecker, ProofError) {
	return &GithubChecker{p}, nil
}

func (rc *GithubChecker) CheckHint(h SigHint) ProofError {
	given := strings.ToLower(h.apiUrl)
	u := rc.proof.GetRemoteUsername()
	ok1 := "https://gist.github.com/" + u + "/"
	ok2 := "https://gist.githubusercontent.com/" + u + "/"
	if strings.HasPrefix(given, ok1) || strings.HasPrefix(given, ok2) {
		return nil
	} else {
		return NewProofError(PROOF_BAD_API_URL,
			"Bad hint from server; URL start with either '%s' OR '%s'", ok1, ok2)
	}
}

func (rc *GithubChecker) CheckStatus(h SigHint) ProofError {
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
