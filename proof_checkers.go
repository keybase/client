package libkb

import (
	"fmt"
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

// Might be overkill, let's revisit...
//func (e *ProofApiError) Error() string {
//	return fmt.Sprintf("%s (url=%s; code=%d)", e.Desc, e.url, int(e.Status))
//}

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
		return NewProofApiError(PROOF_INTERNAL_ERROR, u, err.Error())
	}
}

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
			"twitter": func(l RemoteProofChainLink) (ProofChecker, ProofError) {
				return NewTwitterChecker(l)
			},
			"coinbase": func(l RemoteProofChainLink) (ProofChecker, ProofError) {
				return NewCoinbaseChecker(l)
			},
			"github": func(l RemoteProofChainLink) (ProofChecker, ProofError) {
				return NewGithubChecker(l)
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
