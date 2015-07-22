package libkbfs

import (
	keybase1 "github.com/keybase/client/protocol/go"
)

const (
	// StatusCodeBServerError is the error code for a generic block server error.
	StatusCodeBServerError = 2700
	// StatusCodeBServerErrorBadRequest is the error code for a generic client error.
	StatusCodeBServerErrorBadRequest = 2701
	// StatusCodeBServerErrorUnauthorized is the error code for when the session has not been validated
	StatusCodeBServerErrorUnauthorized = 2702
	// StatusCodeBServerErrorOverQuota is the error code for when the user has exceeded his quota
	StatusCodeBServerErrorOverQuota = 2703
	// StatusCodeBServerErrorBlockNonExistent is the error code for when bserver cannot find a block
	StatusCodeBServerErrorBlockNonExistent = 2704
)

// BServerError is a generic bserver-side error.
type BServerError struct {
	Msg string
}

// ToStatus implements the ExportableError interface for BServerError.
func (e BServerError) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeBServerError
	s.Name = "SERVER_ERROR"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for BServerError.
func (e BServerError) Error() string {
	return e.Msg
}

// BServerErrorBadRequest is a generic client-side error.
type BServerErrorBadRequest struct {
	Msg string
}

// ToStatus implements the ExportableError interface for BServerError.
func (e BServerErrorBadRequest) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeBServerErrorBadRequest
	s.Name = "BAD_REQUEST"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for BServerError.
func (e BServerErrorBadRequest) Error() string {
	if e.Msg == "" {
		return "BServer: bad client request"
	}
	return e.Msg
}

// BServerErrorUnauthorized is a generic client-side error.
type BServerErrorUnauthorized struct {
	Msg string
}

// ToStatus implements the ExportableError interface for BServerErrorUnauthorized.
func (e BServerErrorUnauthorized) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeBServerErrorUnauthorized
	s.Name = "SESSION_UNAUTHORIZED"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for BServerErrorUnauthorized.
func (e BServerErrorUnauthorized) Error() string {
	if e.Msg == "" {
		return "BServer: session not validated"
	}
	return e.Msg
}

// BServerErrorOverQuota is a generic client-side error.
type BServerErrorOverQuota struct {
	Msg string
}

// ToStatus implements the ExportableError interface for BServerErrorOverQuota.
func (e BServerErrorOverQuota) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeBServerErrorOverQuota
	s.Name = "QUOTA_EXCEEDED"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for BServerErrorOverQuota.
func (e BServerErrorOverQuota) Error() string {
	if e.Msg == "" {
		return "BServer: user has exceeded quota"
	}
	return e.Msg
}

//BServerErrorBlockNonExistent is an exportable error from bserver
type BServerErrorBlockNonExistent struct {
	Msg string
}

// ToStatus implements the ExportableError interface for BServerErrorBlockNonExistent
func (e BServerErrorBlockNonExistent) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeBServerErrorBlockNonExistent
	s.Name = "BLOCK_NONEXISTENT"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for BServerErrorBlockNonExistent
func (e BServerErrorBlockNonExistent) Error() string {
	if e.Msg == "" {
		return "BServer: non-existent block"
	}
	return e.Msg
}
