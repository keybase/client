package libkb

import (
	"fmt"
	"strings"
)

//=============================================================================
//

type ProofError interface {
	error
	GetStatus() ProofStatus
	GetDesc() string
}

func ProofErrorIsSoft(pe ProofError) bool {
	s := int(pe.GetStatus())
	return s >= PROOF_BASE_ERROR && s < PROOF_BASE_HARD_ERROR
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
func (e *ProofErrorImpl) GetDesc() string        { return e.Desc }

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

type FailedAssertionError struct {
	user string
	bad  []AssertionUrl
}

func (u FailedAssertionError) Error() string {
	v := make([]string, len(u.bad), len(u.bad))
	for i, u := range u.bad {
		v[i] = u.ToString()
	}
	return ("for " + u.user + ", the follow assertions failed: " +
		strings.Join(v, ", "))
}

//=============================================================================

type AssertionParseError struct {
	err string
}

func (e AssertionParseError) Error() string {
	return e.err
}

func NewAssertionParseError(s string, a ...interface{}) AssertionParseError {
	return AssertionParseError{
		err: fmt.Sprintf(s, a...),
	}
}

//=============================================================================

type NeedInputError struct {
	err string
}

func (e NeedInputError) Error() string {
	return e.err
}

func NewNeedInputError(s string, a ...interface{}) AssertionParseError {
	return AssertionParseError{
		err: fmt.Sprintf(s, a...),
	}
}

//=============================================================================

type WrongKeyError struct {
	wanted, got *PgpFingerprint
}

func (e WrongKeyError) Error() string {
	return fmt.Sprintf("Server gave wrong key; wanted %s; got %s",
		e.wanted.ToString(), e.got.ToString())
}

//=============================================================================

type UserNotFoundError struct {
	uid UID
	msg string
}

func (u UserNotFoundError) Error() string {
	return fmt.Sprintf("User %s wasn't found (%s)", u.uid.ToString(), u.msg)
}

//=============================================================================

type NoKeyError struct {
	msg string
}

func (u NoKeyError) Error() string {
	if len(u.msg) > 0 {
		return u.msg
	} else {
		return "No public key found"
	}
}

//=============================================================================

type NoSelectedKeyError struct {
	wanted *PgpFingerprint
}

func (n NoSelectedKeyError) Error() string {
	return "Please login again to verify your public key"
}

//=============================================================================

type KeyExistsError struct {
	key *PgpFingerprint
}

func (k KeyExistsError) Error() string {
	return fmt.Sprintf("Key already exists for user (%s)", k.key.ToString())
}

//=============================================================================
