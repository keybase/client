// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsblock

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
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
	// StatusCodeBServerErrorBlockArchived is the error code for a block has been archived
	StatusCodeBServerErrorBlockArchived = 2705
	// StatusCodeBServerErrorNoPermission is the error code for when there's no permission
	StatusCodeBServerErrorNoPermission = 2706
	// StatusCodeBServerErrorBlockDeleted is the error code for a block has been deleted
	StatusCodeBServerErrorBlockDeleted = 2707
	// StatusCodeBServerErrorNonceNonExistent is the error code when a nonce cannot be found
	StatusCodeBServerErrorNonceNonExistent = 2708
	// StatusCodeBServerErrorMaxRefExceeded is the error code to indicate there are too many refs to a block
	StatusCodeBServerErrorMaxRefExceeded = 2709
	// StatusCodeBServerErrorThrottle is the error code to indicate the client should initiate backoff.
	StatusCodeBServerErrorThrottle = 2799
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
	return "BServerError{" + e.Msg + "}"
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
	return "BServerErrorBadRequest{" + e.Msg + "}"
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
	return "BServerErrorUnauthorized{" + e.Msg + "}"
}

// BServerErrorOverQuota is returned when a user is over quota.
type BServerErrorOverQuota struct {
	Msg string
	// Usage indicates the current usage
	Usage int64
	// Limit indicates the current quota limit
	Limit int64
	// Throttled indicates if request has not been completed due to server throttle
	Throttled bool
}

// ToStatus implements the ExportableError interface for BServerErrorOverQuota.
func (e BServerErrorOverQuota) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeBServerErrorOverQuota
	s.Name = "QUOTA_EXCEEDED"
	s.Desc = e.Msg
	s.Fields = append(s.Fields, keybase1.StringKVPair{
		Key:   "QUOTA_USAGE",
		Value: strconv.FormatInt(e.Usage, 10),
	})
	s.Fields = append(s.Fields, keybase1.StringKVPair{
		Key:   "QUOTA_LIMIT",
		Value: strconv.FormatInt(e.Limit, 10),
	})
	s.Fields = append(s.Fields, keybase1.StringKVPair{
		Key:   "QUOTA_THROTTLE",
		Value: strconv.FormatBool(e.Throttled),
	})
	return
}

// Error implements the Error interface for BServerErrorOverQuota.
func (e BServerErrorOverQuota) Error() string {
	return fmt.Sprintf(
		"BServerErrorOverQuota{Msg: %q, Usage: %d, Limit: %d, Throttled: %t}",
		e.Msg, e.Usage, e.Limit, e.Throttled)
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

// Error implements the Error interface for BServerErrorBlockNonExistent.
func (e BServerErrorBlockNonExistent) Error() string {
	if e.Msg == "" {
		return "BServer: block does not exist"
	}
	return "BServerErrorBlockNonExistent{" + e.Msg + "}"
}

//BServerErrorBlockArchived is an exportable error from bserver
type BServerErrorBlockArchived struct {
	Msg string
}

// ToStatus implements the ExportableError interface for BServerErrorBlockArchived
func (e BServerErrorBlockArchived) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeBServerErrorBlockArchived
	s.Name = "BLOCK_ARCHIVED"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for BServerErrorBlockArchived.
func (e BServerErrorBlockArchived) Error() string {
	if e.Msg == "" {
		return "BServer: block is archived"
	}
	return "BServerErrorBlockArchived{" + e.Msg + "}"
}

//BServerErrorBlockDeleted is an exportable error from bserver
type BServerErrorBlockDeleted struct {
	Msg string
}

// ToStatus implements the ExportableError interface for BServerErrorBlockDeleted
func (e BServerErrorBlockDeleted) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeBServerErrorBlockDeleted
	s.Name = "BLOCK_DELETED"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for BServerErrorBlockDeleted
func (e BServerErrorBlockDeleted) Error() string {
	if e.Msg == "" {
		return "BServer: block is deleted"
	}
	return "BServerErrorBlockDeleted{" + e.Msg + "}"
}

//BServerErrorNoPermission is an exportable error from bserver
type BServerErrorNoPermission struct {
	Msg string
}

// ToStatus implements the ExportableError interface for BServerErrorBlockArchived
func (e BServerErrorNoPermission) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeBServerErrorNoPermission
	s.Name = "NO_PERMISSION"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for BServerErrorNoPermission.
func (e BServerErrorNoPermission) Error() string {
	if e.Msg == "" {
		return "BServer: permission denied"
	}
	return "BServerErrorNoPermission{" + e.Msg + "}"
}

//BServerErrorNonceNonExistent is an exportable error from bserver
type BServerErrorNonceNonExistent struct {
	Msg string
}

// ToStatus implements the ExportableError interface for BServerErrorNonceNonExistent
func (e BServerErrorNonceNonExistent) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeBServerErrorNonceNonExistent
	s.Name = "BLOCK_NONCENONEXISTENT"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for BServerErrornonceNonExistent.
func (e BServerErrorNonceNonExistent) Error() string {
	if e.Msg == "" {
		return "BServer: reference nonce does not exist"
	}
	return "BServerErrorNonceNonExistent{" + e.Msg + "}"
}

//BServerErrorMaxRefExceeded is an exportable error from bserver
type BServerErrorMaxRefExceeded struct {
	Msg string
}

// ToStatus implements the ExportableError interface for BServerErrorMaxRefExceeded
func (e BServerErrorMaxRefExceeded) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeBServerErrorMaxRefExceeded
	s.Name = "BLOCK_MAXREFEXCEEDED"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for BServerErrorMaxRefExceeded
func (e BServerErrorMaxRefExceeded) Error() string {
	if e.Msg == "" {
		return "BServer: maximum allowed number of references exceeded"
	}
	return "BServerErrorMaxRefExceeded{" + e.Msg + "}"
}

// BServerErrorThrottle is returned when the server wants the client to backoff.
type BServerErrorThrottle struct {
	Msg string
}

// Error implements the Error interface for BServerErrorThrottle.
func (e BServerErrorThrottle) Error() string {
	return "BServerErrorThrottle{" + e.Msg + "}"
}

// ToStatus implements the ExportableError interface for BServerErrorThrottle.
func (e BServerErrorThrottle) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeBServerErrorThrottle
	s.Name = "ERROR_THROTTLE"
	s.Desc = e.Msg
	return
}

// BServerErrorUnwrapper unwraps errors from a remote block server.
type BServerErrorUnwrapper struct{}

var _ rpc.ErrorUnwrapper = BServerErrorUnwrapper{}

// MakeArg implements rpc.ErrorUnwrapper.
func (eu BServerErrorUnwrapper) MakeArg() interface{} {
	return &keybase1.Status{}
}

// UnwrapError implements rpc.ErrorUnwrapper.
func (eu BServerErrorUnwrapper) UnwrapError(arg interface{}) (appError error, dispatchError error) {
	s, ok := arg.(*keybase1.Status)
	if !ok {
		return nil, errors.New("Error converting arg to keybase1.Status object in BServerErrorUnwrapper.UnwrapError")
	}

	if s == nil || s.Code == 0 {
		return nil, nil
	}

	switch s.Code {
	case StatusCodeBServerError:
		appError = BServerError{Msg: s.Desc}
		break
	case StatusCodeBServerErrorBadRequest:
		appError = BServerErrorBadRequest{Msg: s.Desc}
		break
	case StatusCodeBServerErrorUnauthorized:
		appError = BServerErrorUnauthorized{Msg: s.Desc}
		break
	case StatusCodeBServerErrorOverQuota:
		quotaErr := BServerErrorOverQuota{Msg: s.Desc}
		for _, f := range s.Fields {
			if f.Key == "QUOTA_USAGE" {
				quotaErr.Usage, _ = strconv.ParseInt(f.Value, 10, 64)
			} else if f.Key == "QUOTA_LIMIT" {
				quotaErr.Limit, _ = strconv.ParseInt(f.Value, 10, 64)
			} else if f.Key == "QUOTA_THROTTLE" {
				quotaErr.Throttled, _ = strconv.ParseBool(f.Value)
			}
		}
		appError = quotaErr
		break
	case StatusCodeBServerErrorBlockNonExistent:
		appError = BServerErrorBlockNonExistent{Msg: s.Desc}
		break
	case StatusCodeBServerErrorBlockArchived:
		appError = BServerErrorBlockArchived{Msg: s.Desc}
		break
	case StatusCodeBServerErrorNoPermission:
		appError = BServerErrorNoPermission{Msg: s.Desc}
		break
	case StatusCodeBServerErrorThrottle:
		appError = BServerErrorThrottle{Msg: s.Desc}
		break
	case StatusCodeBServerErrorBlockDeleted:
		appError = BServerErrorBlockDeleted{Msg: s.Desc}
		break
	case StatusCodeBServerErrorNonceNonExistent:
		appError = BServerErrorNonceNonExistent{Msg: s.Desc}
		break
	case StatusCodeBServerErrorMaxRefExceeded:
		appError = BServerErrorMaxRefExceeded{Msg: s.Desc}
		break
	default:
		ase := libkb.AppStatusError{
			Code:   s.Code,
			Name:   s.Name,
			Desc:   s.Desc,
			Fields: make(map[string]string),
		}
		for _, f := range s.Fields {
			ase.Fields[f.Key] = f.Value
		}
		appError = ase
	}

	return appError, nil
}
