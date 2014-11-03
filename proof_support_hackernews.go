package libkb

import (
	"strings"
)

//=============================================================================
// HackerNews
//

type HackerNewsChecker struct {
	proof RemoteProofChainLink
}

func (h *HackerNewsChecker) ApiBase() string {
	return "https://hacker-news.firebaseio.com/v0/user/" + h.proof.GetRemoteUsername()
}
func (h *HackerNewsChecker) ApiUrl() string {
	return h.ApiBase() + "/about.json"
}
func (h *HackerNewsChecker) KarmaUrl() string {
	return h.ApiBase() + "/karma.json"
}
func (h *HackerNewsChecker) HumanUrl() string {
	return "https://news.ycombinator.com/user?id=" + h.proof.GetRemoteUsername()
}

func NewHackerNewsChecker(p RemoteProofChainLink) (*HackerNewsChecker, ProofError) {
	return &HackerNewsChecker{p}, nil
}

func (rc *HackerNewsChecker) CheckHint(h SigHint) ProofError {
	wanted := rc.ApiUrl()
	if cicmp(wanted, h.apiUrl) {
		return nil
	} else {
		return NewProofError(PROOF_BAD_API_URL,
			"Bad hint from server; URL should start with '%s'", wanted)
	}
}

func (rc *HackerNewsChecker) CheckStatus(h SigHint) ProofError {
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

	wanted := ps.ID().ToMediumId()
	G.Log.Debug("| HackerNews profile: %s", res.Body)
	G.Log.Debug("| Wanted signature hash: %s", wanted)
	if !strings.Contains(res.Body, wanted) {
		ret = NewProofError(PROOF_TEXT_NOT_FOUND,
			"Posted text does not include signature '%s'", wanted)
	}

	return ret
}

//
//=============================================================================

func init() {
	RegisterProofCheckHook("hackernews",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewHackerNewsChecker(l)
		})
}

//=============================================================================
