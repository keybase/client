package libkb

import (
	"fmt"
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
