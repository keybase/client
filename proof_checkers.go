package libkb

import (
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

//=============================================================================
// Reddit
//

type RedditChecker struct{}

var REDDIT_PREFIX = "https://www.reddit.com"
var REDDIT_SUB = REDDIT_PREFIX + "/r/keybaseproofs"

func (rc *RedditChecker) CheckApiUrl(h SigHint) bool {
	return strings.Index(strings.ToLower(h.apiUrl), REDDIT_SUB) == 0
}

func (rc *RedditChecker) CheckStatus(h SigHint) ProofStatus {

	return PROOF_OK
}

//
//=============================================================================
