package libkb

import ()

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
	PROOF_BAD_HINT_TEXT = 307
)

type ProofStatus int

type ProofChecker interface {
	CheckHint(h SigHint) ProofError
	CheckStatus(h SigHint) ProofError
}

//
//=============================================================================

//=============================================================================
//

type ProofCheckHook func(l RemoteProofChainLink) (ProofChecker, ProofError)

var _dispatch = make(map[string]ProofCheckHook)

func RegisterProofCheckHook(s string, h ProofCheckHook) {
	_dispatch[s] = h
}

func NewProofChecker(l RemoteProofChainLink) (ProofChecker, ProofError) {
	k := l.TableKey()
	hook, found := _dispatch[l.TableKey()]
	if !found {
		return nil, NewProofError(PROOF_UNKNOWN_TYPE,
			"No proof checker for type: %s", k)
	}
	return hook(l)
}

//
//=============================================================================
