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
	// StatusCodeServerError is the error code for a generic block server error.
	StatusCodeServerError = 2700
	// StatusCodeServerErrorBadRequest is the error code for a generic client error.
	StatusCodeServerErrorBadRequest = 2701
	// StatusCodeServerErrorUnauthorized is the error code for when the session has not been validated
	StatusCodeServerErrorUnauthorized = 2702
	// StatusCodeServerErrorOverQuota is the error code for when the user has exceeded his quota
	StatusCodeServerErrorOverQuota = 2703
	// StatusCodeServerErrorBlockNonExistent is the error code for when bserver cannot find a block
	StatusCodeServerErrorBlockNonExistent = 2704
	// StatusCodeServerErrorBlockArchived is the error code for a block has been archived
	StatusCodeServerErrorBlockArchived = 2705
	// StatusCodeServerErrorNoPermission is the error code for when there's no permission
	StatusCodeServerErrorNoPermission = 2706
	// StatusCodeServerErrorBlockDeleted is the error code for a block has been deleted
	StatusCodeServerErrorBlockDeleted = 2707
	// StatusCodeServerErrorNonceNonExistent is the error code when a nonce cannot be found
	StatusCodeServerErrorNonceNonExistent = 2708
	// StatusCodeServerErrorMaxRefExceeded is the error code to indicate there are too many refs to a block
	StatusCodeServerErrorMaxRefExceeded = 2709
	// StatusCodeServerErrorThrottle is the error code to indicate the client should initiate backoff.
	StatusCodeServerErrorThrottle = 2799
)

// ServerError is a generic bserver-side error.
type ServerError struct {
	Msg string
}

// ToStatus implements the ExportableError interface for ServerError.
func (e ServerError) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerError
	s.Name = "SERVER_ERROR"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for ServerError.
func (e ServerError) Error() string {
	return "ServerError{" + e.Msg + "}"
}

// ServerErrorBadRequest is a generic client-side error.
type ServerErrorBadRequest struct {
	Msg string
}

// ToStatus implements the ExportableError interface for ServerError.
func (e ServerErrorBadRequest) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorBadRequest
	s.Name = "BAD_REQUEST"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for ServerError.
func (e ServerErrorBadRequest) Error() string {
	if e.Msg == "" {
		return "Server: bad client request"
	}
	return "ServerErrorBadRequest{" + e.Msg + "}"
}

// ServerErrorUnauthorized is a generic client-side error.
type ServerErrorUnauthorized struct {
	Msg string
}

// ToStatus implements the ExportableError interface for ServerErrorUnauthorized.
func (e ServerErrorUnauthorized) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorUnauthorized
	s.Name = "SESSION_UNAUTHORIZED"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for ServerErrorUnauthorized.
func (e ServerErrorUnauthorized) Error() string {
	if e.Msg == "" {
		return "Server: session not validated"
	}
	return "ServerErrorUnauthorized{" + e.Msg + "}"
}

// ServerErrorOverQuota is returned when a user is over quota.
type ServerErrorOverQuota struct {
	Msg string
	// Usage indicates the current usage
	Usage int64
	// Limit indicates the current quota limit
	Limit int64
	// Throttled indicates if request has not been completed due to server throttle
	Throttled bool
}

// ToStatus implements the ExportableError interface for ServerErrorOverQuota.
func (e ServerErrorOverQuota) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorOverQuota
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

// Error implements the Error interface for ServerErrorOverQuota.
func (e ServerErrorOverQuota) Error() string {
	return fmt.Sprintf(
		"ServerErrorOverQuota{Msg: %q, Usage: %d, Limit: %d, Throttled: %t}",
		e.Msg, e.Usage, e.Limit, e.Throttled)
}

//ServerErrorBlockNonExistent is an exportable error from bserver
type ServerErrorBlockNonExistent struct {
	Msg string
}

// ToStatus implements the ExportableError interface for ServerErrorBlockNonExistent
func (e ServerErrorBlockNonExistent) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorBlockNonExistent
	s.Name = "BLOCK_NONEXISTENT"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for ServerErrorBlockNonExistent.
func (e ServerErrorBlockNonExistent) Error() string {
	if e.Msg == "" {
		return "Server: block does not exist"
	}
	return "ServerErrorBlockNonExistent{" + e.Msg + "}"
}

//ServerErrorBlockArchived is an exportable error from bserver
type ServerErrorBlockArchived struct {
	Msg string
}

// ToStatus implements the ExportableError interface for ServerErrorBlockArchived
func (e ServerErrorBlockArchived) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorBlockArchived
	s.Name = "BLOCK_ARCHIVED"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for ServerErrorBlockArchived.
func (e ServerErrorBlockArchived) Error() string {
	if e.Msg == "" {
		return "Server: block is archived"
	}
	return "ServerErrorBlockArchived{" + e.Msg + "}"
}

//ServerErrorBlockDeleted is an exportable error from bserver
type ServerErrorBlockDeleted struct {
	Msg string
}

// ToStatus implements the ExportableError interface for ServerErrorBlockDeleted
func (e ServerErrorBlockDeleted) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorBlockDeleted
	s.Name = "BLOCK_DELETED"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for ServerErrorBlockDeleted
func (e ServerErrorBlockDeleted) Error() string {
	if e.Msg == "" {
		return "Server: block is deleted"
	}
	return "ServerErrorBlockDeleted{" + e.Msg + "}"
}

//ServerErrorNoPermission is an exportable error from bserver
type ServerErrorNoPermission struct {
	Msg string
}

// ToStatus implements the ExportableError interface for ServerErrorBlockArchived
func (e ServerErrorNoPermission) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorNoPermission
	s.Name = "NO_PERMISSION"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for ServerErrorNoPermission.
func (e ServerErrorNoPermission) Error() string {
	if e.Msg == "" {
		return "Server: permission denied"
	}
	return "ServerErrorNoPermission{" + e.Msg + "}"
}

//ServerErrorNonceNonExistent is an exportable error from bserver
type ServerErrorNonceNonExistent struct {
	Msg string
}

// ToStatus implements the ExportableError interface for ServerErrorNonceNonExistent
func (e ServerErrorNonceNonExistent) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorNonceNonExistent
	s.Name = "BLOCK_NONCENONEXISTENT"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for ServerErrornonceNonExistent.
func (e ServerErrorNonceNonExistent) Error() string {
	if e.Msg == "" {
		return "Server: reference nonce does not exist"
	}
	return "ServerErrorNonceNonExistent{" + e.Msg + "}"
}

//ServerErrorMaxRefExceeded is an exportable error from bserver
type ServerErrorMaxRefExceeded struct {
	Msg string
}

// ToStatus implements the ExportableError interface for ServerErrorMaxRefExceeded
func (e ServerErrorMaxRefExceeded) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorMaxRefExceeded
	s.Name = "BLOCK_MAXREFEXCEEDED"
	s.Desc = e.Msg
	return
}

// Error implements the Error interface for ServerErrorMaxRefExceeded
func (e ServerErrorMaxRefExceeded) Error() string {
	if e.Msg == "" {
		return "Server: maximum allowed number of references exceeded"
	}
	return "ServerErrorMaxRefExceeded{" + e.Msg + "}"
}

// ServerErrorThrottle is returned when the server wants the client to backoff.
type ServerErrorThrottle struct {
	Msg string
}

// Error implements the Error interface for ServerErrorThrottle.
func (e ServerErrorThrottle) Error() string {
	return "ServerErrorThrottle{" + e.Msg + "}"
}

// ToStatus implements the ExportableError interface for ServerErrorThrottle.
func (e ServerErrorThrottle) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorThrottle
	s.Name = "ERROR_THROTTLE"
	s.Desc = e.Msg
	return
}

// ServerErrorUnwrapper unwraps errors from a remote block server.
type ServerErrorUnwrapper struct{}

var _ rpc.ErrorUnwrapper = ServerErrorUnwrapper{}

// MakeArg implements rpc.ErrorUnwrapper.
func (eu ServerErrorUnwrapper) MakeArg() interface{} {
	return &keybase1.Status{}
}

// UnwrapError implements rpc.ErrorUnwrapper.
func (eu ServerErrorUnwrapper) UnwrapError(arg interface{}) (appError error, dispatchError error) {
	s, ok := arg.(*keybase1.Status)
	if !ok {
		return nil, errors.New("Error converting arg to keybase1.Status object in ServerErrorUnwrapper.UnwrapError")
	}

	if s == nil || s.Code == 0 {
		return nil, nil
	}

	switch s.Code {
	case StatusCodeServerError:
		appError = ServerError{Msg: s.Desc}
	case StatusCodeServerErrorBadRequest:
		appError = ServerErrorBadRequest{Msg: s.Desc}
	case StatusCodeServerErrorUnauthorized:
		appError = ServerErrorUnauthorized{Msg: s.Desc}
	case StatusCodeServerErrorOverQuota:
		quotaErr := ServerErrorOverQuota{Msg: s.Desc}
		for _, f := range s.Fields {
			switch {
			case f.Key == "QUOTA_USAGE":
				quotaErr.Usage, _ = strconv.ParseInt(f.Value, 10, 64)
			case f.Key == "QUOTA_LIMIT":
				quotaErr.Limit, _ = strconv.ParseInt(f.Value, 10, 64)
			case f.Key == "QUOTA_THROTTLE":
				quotaErr.Throttled, _ = strconv.ParseBool(f.Value)
			}
		}
		appError = quotaErr
	case StatusCodeServerErrorBlockNonExistent:
		appError = ServerErrorBlockNonExistent{Msg: s.Desc}
	case StatusCodeServerErrorBlockArchived:
		appError = ServerErrorBlockArchived{Msg: s.Desc}
	case StatusCodeServerErrorNoPermission:
		appError = ServerErrorNoPermission{Msg: s.Desc}
	case StatusCodeServerErrorThrottle:
		appError = ServerErrorThrottle{Msg: s.Desc}
	case StatusCodeServerErrorBlockDeleted:
		appError = ServerErrorBlockDeleted{Msg: s.Desc}
	case StatusCodeServerErrorNonceNonExistent:
		appError = ServerErrorNonceNonExistent{Msg: s.Desc}
	case StatusCodeServerErrorMaxRefExceeded:
		appError = ServerErrorMaxRefExceeded{Msg: s.Desc}
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

// IsThrottleError returns whether or not the given error signals
// throttling.
func IsThrottleError(err error) bool {
	if _, ok := err.(ServerErrorThrottle); ok {
		return true
	}
	if quotaErr, ok := err.(ServerErrorOverQuota); ok && quotaErr.Throttled {
		return true
	}
	return false
}
