// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

const (
	// StatusCodeServerError is the error code for a generic server error.
	StatusCodeServerError = 2800
	// StatusCodeServerErrorBadRequest is the error code for a generic client error.
	StatusCodeServerErrorBadRequest = 2801
	// StatusCodeServerErrorConflictRevision is the error code for a revision conflict error.
	StatusCodeServerErrorConflictRevision = 2802
	// StatusCodeServerErrorConflictPrevRoot is the error code for a PrevRoot pointer conflict error.
	StatusCodeServerErrorConflictPrevRoot = 2803
	// StatusCodeServerErrorConflictDiskUsage is the error code for a disk usage conflict error.
	StatusCodeServerErrorConflictDiskUsage = 2804
	// StatusCodeServerErrorLocked is the error code to indicate the folder truncation lock is locked.
	StatusCodeServerErrorLocked = 2805
	// StatusCodeServerErrorUnauthorized is the error code to indicate the client is unauthorized to perform
	// a certain operation. This is also used to indicate an object isn't found.
	StatusCodeServerErrorUnauthorized = 2806
	// StatusCodeServerErrorThrottle is the error code to indicate the client should initiate backoff.
	StatusCodeServerErrorThrottle = 2807
	// StatusCodeServerErrorConditionFailed is the error code to indicate the write condition failed.
	StatusCodeServerErrorConditionFailed = 2808
	// StatusCodeServerErrorWriteAccess is the error code to indicate the client isn't authorized to
	// write to a TLF.
	StatusCodeServerErrorWriteAccess = 2809
	// StatusCodeServerErrorConflictFolderMapping is the error code for a folder handle to folder ID
	// mapping conflict error.
	StatusCodeServerErrorConflictFolderMapping = 2810
	// StatusCodeServerErrorTooManyFoldersCreated is the error code to
	// indicate that the user has created more folders than their limit.
	StatusCodeServerErrorTooManyFoldersCreated = 2811
	// StatusCodeServerErrorCannotReadFinalizedTLF is the error code
	// to indicate that a reader has requested to read a TLF ID that
	// has been finalized, which isn't allowed.
	StatusCodeServerErrorCannotReadFinalizedTLF = 2812
	// StatusCodeServerErrorLockConflict is the error code returned by
	// a MD write operation to indicate a lock conflict has happened and the MD
	// has not been written. The lock conflict could be due to:
	//   1) a lockID that client required the write to be contingent on is not
	//      held at the time server tries to commit the MD, or
	//   2) a implicit team migration lock is held on server, and the MD that
	//      the client tried to write was either a rekey MD update or a MDv2
	//      update, and was blocked by server.
	StatusCodeServerErrorLockConflict = 2813
	// StatusCodeServerErrorClassicTLFDoesNotExist is the error code returned by a
	// MD get operation to indicate that a classic TLF is not found, and client
	// has specified not to create one. Normally upon this error, KBFS client
	// should ask service to create an implicit team for the give handle, and
	// use the i-team backed TLF.
	StatusCodeServerErrorClassicTLFDoesNotExist = 2814
	// StatusCodeServerErrorMissingFolderHandle is the error code
	// returned by the MD GetFolderHandle operation to indicate that a
	// handle isn't found for a particular folder ID.  It's only
	// returned if implicit teams is enabled, and likely indicates
	// that the folder ID has been created by a client for an
	// implicit-team-backed TLF, but no MDs have yet been written to
	// the TLF.
	StatusCodeServerErrorMissingFolderHandle = 2815
)

// ServerError is a generic server-side error.
type ServerError struct {
	Err error
}

// ToStatus implements the ExportableError interface for ServerError.
func (e ServerError) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerError
	s.Name = "SERVER_ERROR"
	s.Desc = e.Error()
	return
}

// Error implements the Error interface for ServerError.
func (e ServerError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}
	return "ServerError"
}

// ServerErrorBadRequest is a generic client-side error.
type ServerErrorBadRequest struct {
	Reason string
}

// ToStatus implements the ExportableError interface for ServerErrorBadRequest.
func (e ServerErrorBadRequest) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorBadRequest
	s.Name = "BAD_REQUEST"
	s.Desc = e.Reason
	return
}

// Error implements the Error interface for ServerErrorBadRequest.
func (e ServerErrorBadRequest) Error() string {
	return fmt.Sprintf("Bad MD server request: %s", e.Reason)
}

// ServerErrorConflictRevision is returned when the passed MD block is inconsistent with current history.
type ServerErrorConflictRevision struct {
	Desc     string
	Expected Revision
	Actual   Revision
}

// Error implements the Error interface for ServerErrorConflictRevision.
func (e ServerErrorConflictRevision) Error() string {
	if e.Desc == "" {
		return fmt.Sprintf("Conflict: expected revision %d, actual %d", e.Expected, e.Actual)
	}
	return "MDServerConflictRevision{" + e.Desc + "}"
}

// ToStatus implements the ExportableError interface for ServerErrorConflictRevision.
func (e ServerErrorConflictRevision) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorConflictRevision
	s.Name = "CONFLICT_REVISION"
	s.Desc = e.Error()
	return
}

// ServerErrorConflictPrevRoot is returned when the passed MD block is inconsistent with current history.
type ServerErrorConflictPrevRoot struct {
	Desc     string
	Expected ID
	Actual   ID
}

// Error implements the Error interface for ServerErrorConflictPrevRoot.
func (e ServerErrorConflictPrevRoot) Error() string {
	if e.Desc == "" {
		return fmt.Sprintf("Conflict: expected previous root %v, actual %v", e.Expected, e.Actual)
	}
	return "MDServerConflictPrevRoot{" + e.Desc + "}"
}

// ToStatus implements the ExportableError interface for ServerErrorConflictPrevRoot.
func (e ServerErrorConflictPrevRoot) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorConflictPrevRoot
	s.Name = "CONFLICT_PREV_ROOT"
	s.Desc = e.Error()
	return
}

// ServerErrorConflictDiskUsage is returned when the passed MD block is inconsistent with current history.
type ServerErrorConflictDiskUsage struct {
	Desc     string
	Expected uint64
	Actual   uint64
}

// ToStatus implements the ExportableError interface for ServerErrorConflictDiskUsage.
func (e ServerErrorConflictDiskUsage) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorConflictDiskUsage
	s.Name = "CONFLICT_DISK_USAGE"
	s.Desc = e.Error()
	return
}

// Error implements the Error interface for ServerErrorConflictDiskUsage
func (e ServerErrorConflictDiskUsage) Error() string {
	if e.Desc == "" {
		return fmt.Sprintf("Conflict: expected disk usage %d, actual %d", e.Expected, e.Actual)
	}
	return "ServerErrorConflictDiskUsage{" + e.Desc + "}"
}

// ServerErrorLocked is returned when the folder truncation lock is acquired by someone else.
type ServerErrorLocked struct {
}

// Error implements the Error interface for ServerErrorLocked.
func (e ServerErrorLocked) Error() string {
	return "ServerErrorLocked{}"
}

// ToStatus implements the ExportableError interface for ServerErrorLocked.
func (e ServerErrorLocked) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorLocked
	s.Name = "LOCKED"
	s.Desc = e.Error()
	return
}

// ServerErrorUnauthorized is returned when a device requests a key half which doesn't belong to it.
type ServerErrorUnauthorized struct {
	Err error
}

// Error implements the Error interface for ServerErrorUnauthorized.
func (e ServerErrorUnauthorized) Error() string {
	msg := "MDServer Unauthorized"
	if e.Err != nil {
		msg += ": " + e.Err.Error()
	}
	return msg
}

// ToStatus implements the ExportableError interface for ServerErrorUnauthorized.
func (e ServerErrorUnauthorized) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorUnauthorized
	s.Name = "UNAUTHORIZED"
	s.Desc = e.Error()
	return
}

// ServerErrorWriteAccess is returned when the client isn't authorized to
// write to a TLF.
type ServerErrorWriteAccess struct{}

// Error implements the Error interface for ServerErrorWriteAccess.
func (e ServerErrorWriteAccess) Error() string {
	return "ServerErrorWriteAccess{}"
}

// ToStatus implements the ExportableError interface for ServerErrorWriteAccess.
func (e ServerErrorWriteAccess) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorWriteAccess
	s.Name = "WRITE_ACCESS"
	s.Desc = e.Error()
	return
}

// ServerErrorThrottle is returned when the server wants the client to backoff.
type ServerErrorThrottle struct {
	Err              error
	SuggestedRetryIn *time.Duration
}

// Error implements the Error interface for ServerErrorThrottle.
func (e ServerErrorThrottle) Error() string {
	if e.SuggestedRetryIn == nil {
		return fmt.Sprintf("ServerErrorThrottle{%s}", e.Err.Error())
	}
	return fmt.Sprintf("ServerErrorThrottle[%s]{%s}", *e.SuggestedRetryIn, e.Err.Error())
}

// ToStatus implements the ExportableError interface for ServerErrorThrottle.
func (e ServerErrorThrottle) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorThrottle
	s.Name = "THROTTLE"
	s.Desc = e.Err.Error()
	if e.SuggestedRetryIn != nil {
		s.Fields = append(s.Fields, keybase1.StringKVPair{
			Key:   "suggestedRetryInMS",
			Value: strconv.FormatInt(int64((*e.SuggestedRetryIn)/time.Millisecond), 10),
		})
	}
	return
}

// ServerErrorConditionFailed is returned when a conditonal write failed.
// This means there was a race and the caller should consider it a conflict.
type ServerErrorConditionFailed struct {
	Err            error
	ShouldThrottle bool
}

// Error implements the Error interface for ServerErrorConditionFailed.
func (e ServerErrorConditionFailed) Error() string {
	return "ServerErrorConditionFailed{" + e.Err.Error() + "}"
}

// ToStatus implements the ExportableError interface for ServerErrorConditionFailed.
func (e ServerErrorConditionFailed) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorConditionFailed
	s.Name = "CONDITION_FAILED"
	s.Desc = e.Err.Error()
	s.Fields = []keybase1.StringKVPair{
		{
			Key:   "ShouldThrottle",
			Value: strconv.FormatBool(e.ShouldThrottle),
		},
	}
	return
}

// ServerErrorConflictFolderMapping is returned when there is a folder handle to folder
// ID mapping mismatch.
type ServerErrorConflictFolderMapping struct {
	Desc     string
	Expected tlf.ID
	Actual   tlf.ID
}

// Error implements the Error interface for ServerErrorConflictFolderMapping.
func (e ServerErrorConflictFolderMapping) Error() string {
	if e.Desc == "" {
		return fmt.Sprintf("Conflict: expected folder ID %s, actual %s",
			e.Expected, e.Actual)
	}
	return "ServerErrorConflictFolderMapping{" + e.Desc + "}"
}

// ToStatus implements the ExportableError interface for ServerErrorConflictFolderMapping
func (e ServerErrorConflictFolderMapping) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorConflictFolderMapping
	s.Name = "CONFLICT_FOLDER_MAPPING"
	s.Desc = e.Error()
	return
}

// ServerErrorTooManyFoldersCreated is returned when a user has created more
// folders than their limit allows.
type ServerErrorTooManyFoldersCreated struct {
	Created uint64
	Limit   uint64
}

// Error implements the Error interface for ServerErrorTooManyFoldersCreated.
func (e ServerErrorTooManyFoldersCreated) Error() string {
	return fmt.Sprintf("Too many folders created. Created: %d, limit: %d",
		e.Created, e.Limit)
}

// ToStatus implements the ExportableError interface for ServerErrorConflictFolderMapping
func (e ServerErrorTooManyFoldersCreated) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorTooManyFoldersCreated
	s.Name = "TOO_MANY_FOLDERS_CREATED"
	s.Desc = e.Error()
	s.Fields = []keybase1.StringKVPair{
		{Key: "Limit", Value: strconv.FormatUint(e.Limit, 10)},
		{Key: "Created", Value: strconv.FormatUint(e.Created, 10)},
	}
	return
}

// ServerErrorCannotReadFinalizedTLF is returned when the client
// isn't authorized to read a finalized TLF.
type ServerErrorCannotReadFinalizedTLF struct{}

// Error implements the Error interface for
// ServerErrorCannotReadFinalizedTLF.
func (e ServerErrorCannotReadFinalizedTLF) Error() string {
	return "ServerErrorCannotReadFinalizedTLF{}"
}

// ToStatus implements the ExportableError interface for
// ServerErrorCannotReadFinalizedTLF.
func (e ServerErrorCannotReadFinalizedTLF) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorCannotReadFinalizedTLF
	s.Name = "CANNOT_READ_FINALIZED_TLF"
	s.Desc = e.Error()
	return
}

// ServerErrorLockConflict is the error type for
// StatusCodeServerErrorLockConflict.
type ServerErrorLockConflict struct{}

// Error implements the Error interface.
func (e ServerErrorLockConflict) Error() string {
	return "This operation conflicted with another operation on the server, " +
		"or it took too long. Please try again."
}

// ToStatus implements the ExportableError interface.
func (e ServerErrorLockConflict) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorLockConflict
	s.Name = "REQUIRED_LOCK_CONFLICT"
	s.Desc = e.Error()
	return
}

// ServerErrorClassicTLFDoesNotExist is the error type for
// StatusCodeServerErrorClassicTLFDoesNotExist.
type ServerErrorClassicTLFDoesNotExist struct{}

// Error implements the Error interface.
func (e ServerErrorClassicTLFDoesNotExist) Error() string {
	return "ServerErrorClassicTLFDoesNotExist{}"
}

// ToStatus implements the ExportableError interface.
func (e ServerErrorClassicTLFDoesNotExist) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorClassicTLFDoesNotExist
	s.Name = "CLASSIC_TLF_DOES_NOT_EXIST"
	s.Desc = e.Error()
	return
}

// ServerErrorMissingFolderHandle is the error type for
// StatusCodeServerErrorMissingFolderHandle.
type ServerErrorMissingFolderHandle struct{}

// Error implements the Error interface.
func (e ServerErrorMissingFolderHandle) Error() string {
	return "ServerErrorMissingFolderHandle{}"
}

// ToStatus implements the ExportableError interface.
func (e ServerErrorMissingFolderHandle) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeServerErrorMissingFolderHandle
	s.Name = "MISSING_FOLDER_HANDLE"
	s.Desc = e.Error()
	return
}

// ServerErrorUnwrapper is an implementation of rpc.ErrorUnwrapper
// for errors coming from the MDServer.
type ServerErrorUnwrapper struct{}

var _ rpc.ErrorUnwrapper = ServerErrorUnwrapper{}

// MakeArg implements rpc.ErrorUnwrapper for ServerErrorUnwrapper.
func (eu ServerErrorUnwrapper) MakeArg() interface{} {
	return &keybase1.Status{}
}

// UnwrapError implements rpc.ErrorUnwrapper for ServerErrorUnwrapper.
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
		appError = ServerError{errors.New(s.Desc)}
	case StatusCodeServerErrorBadRequest:
		appError = ServerErrorBadRequest{Reason: s.Desc}
	case StatusCodeServerErrorConflictRevision:
		appError = ServerErrorConflictRevision{Desc: s.Desc}
	case StatusCodeServerErrorConflictPrevRoot:
		appError = ServerErrorConflictPrevRoot{Desc: s.Desc}
	case StatusCodeServerErrorConflictDiskUsage:
		appError = ServerErrorConflictDiskUsage{Desc: s.Desc}
	case StatusCodeServerErrorLocked:
		appError = ServerErrorLocked{}
	case StatusCodeServerErrorUnauthorized:
		appError = ServerErrorUnauthorized{}
	case StatusCodeServerErrorThrottle:
		var suggestedRetryIn *time.Duration
		for _, kv := range s.Fields {
			if kv.Key == "suggestedRetryInMS" {
				if ms, err := strconv.Atoi(kv.Value); err != nil {
					d := time.Duration(ms) * time.Millisecond
					suggestedRetryIn = &d
				}
				break
			}
		}
		appError = ServerErrorThrottle{
			Err:              errors.New(s.Desc),
			SuggestedRetryIn: suggestedRetryIn,
		}
	case StatusCodeServerErrorConditionFailed:
		shouldThrottle := false
		for _, kv := range s.Fields {
			if kv.Key == "ShouldThrottle" {
				shouldThrottle, _ = strconv.ParseBool(kv.Value)
				break
			}
		}
		appError = ServerErrorConditionFailed{
			Err:            errors.New(s.Desc),
			ShouldThrottle: shouldThrottle,
		}
	case StatusCodeServerErrorWriteAccess:
		appError = ServerErrorWriteAccess{}
	case StatusCodeServerErrorConflictFolderMapping:
		appError = ServerErrorConflictFolderMapping{Desc: s.Desc}
	case StatusCodeServerErrorTooManyFoldersCreated:
		err := ServerErrorTooManyFoldersCreated{}
		for _, f := range s.Fields {
			switch f.Key {
			case "Limit":
				err.Limit, _ = strconv.ParseUint(f.Value, 10, 64)
			case "Created":
				err.Created, _ = strconv.ParseUint(f.Value, 10, 64)
			}
		}
		appError = err
	case StatusCodeServerErrorCannotReadFinalizedTLF:
		appError = ServerErrorCannotReadFinalizedTLF{}
	case StatusCodeServerErrorLockConflict:
		appError = ServerErrorLockConflict{}
	case StatusCodeServerErrorClassicTLFDoesNotExist:
		appError = ServerErrorClassicTLFDoesNotExist{}
	case StatusCodeServerErrorMissingFolderHandle:
		appError = ServerErrorMissingFolderHandle{}
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
