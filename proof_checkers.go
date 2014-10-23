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
	PROOF_BAD_API_URL   = 304
	PROOF_UNKNOWN_TYPE  = 305
	PROOF_NO_HINT       = 306
)

//=============================================================================
//
type ProofStatus int

type ProofError interface {
	error
	GetStatus() ProofStatus
}

type ProofErrorImpl struct {
	Status ProofStatus
	Desc   string
}

func NewProofError(s ProofStatus, d string, a ...interface{}) *ProofErrorImpl {
	return &ProofErrorImpl{s, fmt.Sprintf(d, a...)}
}

func (e *ProofErrorImpl) Error() string {
	return fmt.Sprintf("%s (code=%d)", e.Desc, int(e.Status))
}

func (e *ProofErrorImpl) GetStatus() ProofStatus { return e.Status }

type ProofApiError struct {
	ProofErrorImpl
	url string
}

func (e *ProofApiError) Error() string {
	return fmt.Sprintf("%s (url=%s; code=%d)", e.Desc, e.url, int(e.Status))
}

func NewProofApiError(s ProofStatus, u string, d string, a ...interface{}) *ProofApiError {
	base := NewProofError(s, d, a...)
	return &ProofApiError{*base, u}
}

//
//=============================================================================

type ProofChecker interface {
	CheckHint(h SigHint) ProofError
	CheckStatus(h SigHint) ProofError
}

//
//=============================================================================

func XapiError(err error, u string) *ProofApiError {
	if ae, ok := err.(*ApiError); ok {
		var code ProofStatus = PROOF_NONE
		switch ae.Code / 100 {
		case 3:
			code = PROOF_HTTP_300
		case 4:
			code = PROOF_HTTP_400
		case 5:
			code = PROOF_HTTP_500
		default:
			code = PROOF_HTTP_OTHER
		}
		return NewProofApiError(code, u, ae.Msg)
	} else {
		return NewProofApiError(PROOF_INTERNAL_ERROR, u, "generic API error")
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

//=============================================================================
//

type proofCheckHook (func(l RemoteProofChainLink) (ProofChecker, ProofError))
type proofCheckDispatch map[string]proofCheckHook

var _dispatch proofCheckDispatch

func getProofCheckDispatch() proofCheckDispatch {
	if _dispatch == nil {
		_dispatch = proofCheckDispatch{
			"reddit": func(l RemoteProofChainLink) (ProofChecker, ProofError) {
				return NewRedditChecker(l)
			},
		}
	}
	return _dispatch
}

func NewProofChecker(l RemoteProofChainLink) (ProofChecker, ProofError) {
	k := l.TableKey()
	hook, found := getProofCheckDispatch()[l.TableKey()]
	if !found {
		return nil, NewProofError(PROOF_UNKNOWN_TYPE,
			"No proof checker for type: %s", k)
	}
	return hook(l)
}

//
//=============================================================================
