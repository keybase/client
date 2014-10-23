package libkb

import (
	"fmt"
	"github.com/keybase/go-jsonw"
	"strings"
)

const (
	PROOF_NONE  = 0
	PROOF_OK    = 1
	PROOF_LOCAL = 2
	PROOF_FOUND = 3 // It's been found in the hunt, but not proven yet

	// Retryable =soft errors
	PROOF_BASE_ERROR        = 100
	PROOF_HOST_UNREACHABLE  = 101
	PROOF_PERMISSION_DENIED = 103 // # Since the user might fix it
	PROOF_FAILED_PARSE      = 106
	PROOF_DNS_ERROR         = 107
	PROOF_AUTH_FAILED       = 108
	PROOF_HTTP_500          = 150
	PROOF_TIMEOUT           = 160
	PROOF_INTERNAL_ERROR    = 170

	// Likely will result in a hard error, if repeated enough
	PROOF_BASE_HARD_ERROR  = 200
	PROOF_NOT_FOUND        = 201
	PROOF_CONTENT_FAILURE  = 202
	PROOF_BAD_USERNAME     = 203
	PROOF_BAD_REMOTE_ID    = 204
	PROOF_TEXT_NOT_FOUND   = 205
	PROOF_BAD_ARGS         = 206
	PROOF_CONTENT_MISSING  = 207
	PROOF_TITLE_NOT_FOUND  = 208
	PROOF_SERVICE_ERROR    = 209
	PROOF_TOR_SKIPPED      = 210
	PROOF_TOR_INCOMPATIBLE = 211
	PROOF_HTTP_300         = 230
	PROOF_HTTP_400         = 240
	PROOF_HTTP_OTHER       = 260
	PROOF_EMPTY_JSON       = 270

	// Hard final errors
	PROOF_DELETED       = 301
	PROOF_SERVICE_DEAD  = 302
	PROOF_BAD_SIGNATURE = 303
)

//=============================================================================
//
type ProofStatus int

type ProofChecker interface {
	CheckApiUrl(h SigHint) bool
	CheckStatus(h SigHint) ProofStatus
}

//
//=============================================================================

func ErrorToProofStatus(err error) ProofStatus {
	if ae, ok := err.(*ApiError); ok {
		switch ae.Code / 100 {
		case 3:
			return PROOF_HTTP_300
		case 4:
			return PROOF_HTTP_400
		case 5:
			return PROOF_HTTP_500
		default:
			return PROOF_HTTP_OTHER
		}
	} else {
		return PROOF_INTERNAL_ERROR
	}
}

//=============================================================================
// Reddit
//

type RedditChecker struct {
	proof RemoteProofChainLink
}

var REDDIT_PREFIX = "https://www.reddit.com"
var REDDIT_SUB = REDDIT_PREFIX + "/r/keybaseproofs"

func NewRedditChecker(p RemoteProofChainLink) (*RedditChecker, error) {
	return &RedditChecker{p}, nil
}

func (rc *RedditChecker) CheckApiUrl(h SigHint) bool {
	return strings.Index(strings.ToLower(h.apiUrl), REDDIT_SUB) == 0
}

func (rc *RedditChecker) UnpackData(inp *jsonw.Wrapper) *jsonw.Wrapper {
	var k1, k2 string
	var err error

	inp.AtIndex(0).AtKey("kind").GetStringVoid(&k1, &err)
	parent := inp.AtIndex(0).AtKey("data").AtKey("children").AtIndex(0)
	parent.AtKey("kind").GetStringVoid(&k2, &err)
	var ret *jsonw.Wrapper

	if err != nil {
		G.Log.Warning("Reddit: Bad proof JSON: %s", err.Error())
	} else if k1 != "Listing" {
		G.Log.Warning("Reddit: Wanted a post of type 'Listing', but got %s", k1)
	} else if k2 != "t3" {
		G.Log.Warning("Reddit: Wanted a child of type 't3' but got %s", k2)
	} else if ret = parent.AtKey("data"); ret.IsNil() {
		G.Log.Warning("Reddit: Couldn't get child data for post")
		ret = nil
	}
	return ret

}

func (rc *RedditChecker) ScreenNameCompare(s1, s2 string) bool {
	return cicmp(s1, s2)
}

func (rc *RedditChecker) CheckData(h SigHint, dat *jsonw.Wrapper) ProofStatus {
	ps, err := OpenSig(rc.proof.GetArmoredSig())
	if err != nil {
		G.Log.Warning("Reddit: bad signature: %s", err.Error())
		return PROOF_BAD_SIGNATURE
	}

	var subreddit, author, selftext, title string

	dat.AtKey("subreddit").GetStringVoid(&subreddit, &err)
	dat.AtKey("author").GetStringVoid(&author, &err)
	dat.AtKey("selftext").GetStringVoid(&selftext, &err)
	dat.AtKey("title").GetStringVoid(&title, &err)

	var ret ProofStatus = PROOF_NONE

	if err != nil {
		G.Log.Warning("Reddit: content missing: %s", err.Error())
		ret = PROOF_CONTENT_MISSING
	} else if strings.ToLower(subreddit) != "keybaseproofs" {
		ret = PROOF_SERVICE_ERROR
	} else if !rc.ScreenNameCompare(author, rc.proof.GetRemoteUsername()) {
		ret = PROOF_BAD_USERNAME
	} else if !strings.Contains(title, ps.ID().ToMediumId()) {
		ret = PROOF_TITLE_NOT_FOUND
	} else if !FindBase64Block(selftext, ps.SigBody, false) {
		ret = PROOF_TEXT_NOT_FOUND
	} else {
		ret = PROOF_OK
	}

	return ret
}

func (rc *RedditChecker) CheckStatus(h SigHint) ProofStatus {
	res, err := G.XAPI.Get(ApiArg{
		Endpoint:    h.apiUrl,
		NeedSession: false,
	})
	if err != nil {
		return ErrorToProofStatus(err)
	}
	if dat := rc.UnpackData(res.Body); err != nil {
		return PROOF_CONTENT_FAILURE
	} else {
		return rc.CheckData(h, dat)
	}
	return PROOF_OK
}

//
//=============================================================================

//=============================================================================
//

type proofCheckHook (func(l RemoteProofChainLink) (ProofChecker, error))
type proofCheckDispatch map[string]proofCheckHook

var _dispatch proofCheckDispatch

func getProofCheckDispatch() proofCheckDispatch {
	if _dispatch == nil {
		_dispatch = proofCheckDispatch{
			"reddit": func(l RemoteProofChainLink) (ProofChecker, error) {
				return NewRedditChecker(l)
			},
		}
	}
	return _dispatch
}

func NewProofChecker(l RemoteProofChainLink) (ProofChecker, error) {
	k := l.TableKey()
	hook, found := getProofCheckDispatch()[l.TableKey()]
	if !found {
		return nil, fmt.Errorf("No proof checker for type: %s", k)
	}
	return hook(l)
}

//
//=============================================================================
