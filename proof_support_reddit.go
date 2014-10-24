package libkb

import (
	"github.com/keybase/go-jsonw"
	"strings"
)

//=============================================================================
// Reddit
//

type RedditChecker struct {
	proof RemoteProofChainLink
}

var REDDIT_PREFIX = "https://www.reddit.com"
var REDDIT_SUB = REDDIT_PREFIX + "/r/keybaseproofs"

func NewRedditChecker(p RemoteProofChainLink) (*RedditChecker, ProofError) {
	return &RedditChecker{p}, nil
}

func (rc *RedditChecker) CheckHint(h SigHint) ProofError {
	if strings.HasPrefix(strings.ToLower(h.apiUrl), REDDIT_SUB) {
		return nil
	} else {
		return NewProofError(PROOF_BAD_API_URL,
			"Bad hint from server; URL should start with '%s'", REDDIT_SUB)
	}
}

func (rc *RedditChecker) UnpackData(inp *jsonw.Wrapper) (*jsonw.Wrapper, ProofError) {
	var k1, k2 string
	var err error

	inp.AtIndex(0).AtKey("kind").GetStringVoid(&k1, &err)
	parent := inp.AtIndex(0).AtKey("data").AtKey("children").AtIndex(0)
	parent.AtKey("kind").GetStringVoid(&k2, &err)
	var ret *jsonw.Wrapper

	var pe ProofError
	var cf ProofStatus = PROOF_CONTENT_FAILURE
	var cm ProofStatus = PROOF_CONTENT_MISSING

	if err != nil {
		pe = NewProofError(cm, "Bad proof JSON: %s", err.Error())
	} else if k1 != "Listing" {
		pe = NewProofError(cf,
			"Reddit: Wanted a post of type 'Listing', but got %s", k1)
	} else if k2 != "t3" {
		pe = NewProofError(cf, "Wanted a child of type 't3' but got %s", k2)
	} else if ret = parent.AtKey("data"); ret.IsNil() {
		pe = NewProofError(cm, "Couldn't get child data for post")
	}

	return ret, pe

}

func (rc *RedditChecker) ScreenNameCompare(s1, s2 string) bool {
	return cicmp(s1, s2)
}

func (rc *RedditChecker) CheckData(h SigHint, dat *jsonw.Wrapper) ProofError {
	ps, err := OpenSig(rc.proof.GetArmoredSig())
	if err != nil {
		return NewProofError(PROOF_BAD_SIGNATURE,
			"Bad signature: %s", err.Error())
	}

	var subreddit, author, selftext, title string

	dat.AtKey("subreddit").GetStringVoid(&subreddit, &err)
	dat.AtKey("author").GetStringVoid(&author, &err)
	dat.AtKey("selftext").GetStringVoid(&selftext, &err)
	dat.AtKey("title").GetStringVoid(&title, &err)

	var ret ProofError

	if err != nil {
		ret = NewProofError(PROOF_CONTENT_MISSING, "content missing: %s", err.Error())
	} else if strings.ToLower(subreddit) != "keybaseproofs" {
		ret = NewProofError(PROOF_SERVICE_ERROR, "the post must be to /r/KeybaseProofs")
	} else if wanted := rc.proof.GetRemoteUsername(); !rc.ScreenNameCompare(author, wanted) {
		ret = NewProofError(PROOF_BAD_USERNAME,
			"Bad post author; wanted '%s' but got '%s'", wanted, author)
	} else if psid := ps.ID().ToMediumId(); !strings.Contains(title, psid) {
		ret = NewProofError(PROOF_TITLE_NOT_FOUND,
			"Missing signature ID (%s) in post title ('%s')",
			psid, title)
	} else if !FindBase64Block(selftext, ps.SigBody, false) {
		ret = NewProofError(PROOF_TEXT_NOT_FOUND, "signature not found in body")
	}

	return ret
}

func (rc *RedditChecker) CheckStatus(h SigHint) ProofError {
	res, err := G.XAPI.Get(ApiArg{
		Endpoint:    h.apiUrl,
		NeedSession: false,
	})
	if err != nil {
		return XapiError(err, h.apiUrl)
	}

	if dat, perr := rc.UnpackData(res.Body); perr != nil {
		return perr
	} else {
		return rc.CheckData(h, dat)
	}
}

//
//=============================================================================

func init() {
	RegisterProofCheckHook("reddit",
		func(l RemoteProofChainLink) (ProofChecker, ProofError) {
			return NewRedditChecker(l)
		})
}

//=============================================================================
