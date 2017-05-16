// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
)

const (
	// StatusCodeMDServerError is the error code for a generic server error.
	StatusCodeMDServerError = 2800
	// StatusCodeMDServerErrorBadRequest is the error code for a generic client error.
	StatusCodeMDServerErrorBadRequest = 2801
	// StatusCodeMDServerErrorConflictRevision is the error code for a revision conflict error.
	StatusCodeMDServerErrorConflictRevision = 2802
	// StatusCodeMDServerErrorConflictPrevRoot is the error code for a PrevRoot pointer conflict error.
	StatusCodeMDServerErrorConflictPrevRoot = 2803
	// StatusCodeMDServerErrorConflictDiskUsage is the error code for a disk usage conflict error.
	StatusCodeMDServerErrorConflictDiskUsage = 2804
	// StatusCodeMDServerErrorLocked is the error code to indicate the folder truncation lock is locked.
	StatusCodeMDServerErrorLocked = 2805
	// StatusCodeMDServerErrorUnauthorized is the error code to indicate the client is unauthorized to perform
	// a certain operation. This is also used to indicate an object isn't found.
	StatusCodeMDServerErrorUnauthorized = 2806
	// StatusCodeMDServerErrorThrottle is the error code to indicate the client should initiate backoff.
	StatusCodeMDServerErrorThrottle = 2807
	// StatusCodeMDServerErrorConditionFailed is the error code to indicate the write condition failed.
	StatusCodeMDServerErrorConditionFailed = 2808
	// StatusCodeMDServerErrorWriteAccess is the error code to indicate the client isn't authorized to
	// write to a TLF.
	StatusCodeMDServerErrorWriteAccess = 2809
	// StatusCodeMDServerErrorConflictFolderMapping is the error code for a folder handle to folder ID
	// mapping conflict error.
	StatusCodeMDServerErrorConflictFolderMapping = 2810
	// StatusCodeMDServerErrorTooManyFoldersCreated is the error code to
	// indicate that the user has created more folders than their limit.
	StatusCodeMDServerErrorTooManyFoldersCreated = 2811
	// StatusCodeMDServerErrorCannotReadFinalizedTLF is the error code
	// to indicate that a reader has requested to read a TLF ID that
	// has been finalized, which isn't allowed.
	StatusCodeMDServerErrorCannotReadFinalizedTLF = 2812
)

// MDServerError is a generic server-side error.
type MDServerError struct {
	Err error
}

// ToStatus implements the ExportableError interface for MDServerError.
func (e MDServerError) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerError
	s.Name = "SERVER_ERROR"
	s.Desc = e.Error()
	return
}

// Error implements the Error interface for MDServerError.
func (e MDServerError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}
	return "MDServerError"
}

// MDServerErrorBadRequest is a generic client-side error.
type MDServerErrorBadRequest struct {
	Reason string
}

// ToStatus implements the ExportableError interface for MDServerErrorBadRequest.
func (e MDServerErrorBadRequest) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerErrorBadRequest
	s.Name = "BAD_REQUEST"
	s.Desc = e.Reason
	return
}

// Error implements the Error interface for MDServerErrorBadRequest.
func (e MDServerErrorBadRequest) Error() string {
	return fmt.Sprintf("Bad MD server request: %s", e.Reason)
}

// MDServerErrorConflictRevision is returned when the passed MD block is inconsistent with current history.
type MDServerErrorConflictRevision struct {
	Desc     string
	Expected kbfsmd.Revision
	Actual   kbfsmd.Revision
}

// Error implements the Error interface for MDServerErrorConflictRevision.
func (e MDServerErrorConflictRevision) Error() string {
	if e.Desc == "" {
		return fmt.Sprintf("Conflict: expected revision %d, actual %d", e.Expected, e.Actual)
	}
	return "MDServerConflictRevision{" + e.Desc + "}"
}

// ToStatus implements the ExportableError interface for MDServerErrorConflictRevision.
func (e MDServerErrorConflictRevision) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerErrorConflictRevision
	s.Name = "CONFLICT_REVISION"
	s.Desc = e.Error()
	return
}

// MDServerErrorConflictPrevRoot is returned when the passed MD block is inconsistent with current history.
type MDServerErrorConflictPrevRoot struct {
	Desc     string
	Expected kbfsmd.ID
	Actual   kbfsmd.ID
}

// Error implements the Error interface for MDServerErrorConflictPrevRoot.
func (e MDServerErrorConflictPrevRoot) Error() string {
	if e.Desc == "" {
		return fmt.Sprintf("Conflict: expected previous root %v, actual %v", e.Expected, e.Actual)
	}
	return "MDServerConflictPrevRoot{" + e.Desc + "}"
}

// ToStatus implements the ExportableError interface for MDServerErrorConflictPrevRoot.
func (e MDServerErrorConflictPrevRoot) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerErrorConflictPrevRoot
	s.Name = "CONFLICT_PREV_ROOT"
	s.Desc = e.Error()
	return
}

// MDServerErrorConflictDiskUsage is returned when the passed MD block is inconsistent with current history.
type MDServerErrorConflictDiskUsage struct {
	Desc     string
	Expected uint64
	Actual   uint64
}

// ToStatus implements the ExportableError interface for MDServerErrorConflictDiskUsage.
func (e MDServerErrorConflictDiskUsage) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerErrorConflictDiskUsage
	s.Name = "CONFLICT_DISK_USAGE"
	s.Desc = e.Error()
	return
}

// Error implements the Error interface for MDServerErrorConflictDiskUsage
func (e MDServerErrorConflictDiskUsage) Error() string {
	if e.Desc == "" {
		return fmt.Sprintf("Conflict: expected disk usage %d, actual %d", e.Expected, e.Actual)
	}
	return "MDServerErrorConflictDiskUsage{" + e.Desc + "}"
}

// MDServerErrorLocked is returned when the folder truncation lock is acquired by someone else.
type MDServerErrorLocked struct {
}

// Error implements the Error interface for MDServerErrorLocked.
func (e MDServerErrorLocked) Error() string {
	return "MDServerErrorLocked{}"
}

// ToStatus implements the ExportableError interface for MDServerErrorLocked.
func (e MDServerErrorLocked) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerErrorLocked
	s.Name = "LOCKED"
	s.Desc = e.Error()
	return
}

// MDServerErrorUnauthorized is returned when a device requests a key half which doesn't belong to it.
type MDServerErrorUnauthorized struct {
	Err error
}

// Error implements the Error interface for MDServerErrorUnauthorized.
func (e MDServerErrorUnauthorized) Error() string {
	msg := "MDServer Unauthorized"
	if e.Err != nil {
		msg += ": " + e.Err.Error()
	}
	return msg
}

// ToStatus implements the ExportableError interface for MDServerErrorUnauthorized.
func (e MDServerErrorUnauthorized) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerErrorUnauthorized
	s.Name = "UNAUTHORIZED"
	s.Desc = e.Error()
	return
}

// MDServerErrorWriteAccess is returned when the client isn't authorized to
// write to a TLF.
type MDServerErrorWriteAccess struct{}

// Error implements the Error interface for MDServerErrorWriteAccess.
func (e MDServerErrorWriteAccess) Error() string {
	return "MDServerErrorWriteAccess{}"
}

// ToStatus implements the ExportableError interface for MDServerErrorWriteAccess.
func (e MDServerErrorWriteAccess) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerErrorWriteAccess
	s.Name = "WRITE_ACCESS"
	s.Desc = e.Error()
	return
}

// MDServerErrorThrottle is returned when the server wants the client to backoff.
type MDServerErrorThrottle struct {
	Err error
}

// Error implements the Error interface for MDServerErrorThrottle.
func (e MDServerErrorThrottle) Error() string {
	return "MDServerErrorThrottle{" + e.Err.Error() + "}"
}

// ToStatus implements the ExportableError interface for MDServerErrorThrottle.
func (e MDServerErrorThrottle) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerErrorThrottle
	s.Name = "THROTTLE"
	s.Desc = e.Err.Error()
	return
}

// MDServerErrorConditionFailed is returned when a conditonal write failed.
// This means there was a race and the caller should consider it a conflcit.
type MDServerErrorConditionFailed struct {
	Err error
}

// Error implements the Error interface for MDServerErrorConditionFailed.
func (e MDServerErrorConditionFailed) Error() string {
	return "MDServerErrorConditionFailed{" + e.Err.Error() + "}"
}

// ToStatus implements the ExportableError interface for MDServerErrorConditionFailed.
func (e MDServerErrorConditionFailed) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerErrorConditionFailed
	s.Name = "CONDITION_FAILED"
	s.Desc = e.Err.Error()
	return
}

// MDServerErrorConflictFolderMapping is returned when there is a folder handle to folder
// ID mapping mismatch.
type MDServerErrorConflictFolderMapping struct {
	Desc     string
	Expected tlf.ID
	Actual   tlf.ID
}

// Error implements the Error interface for MDServerErrorConflictFolderMapping.
func (e MDServerErrorConflictFolderMapping) Error() string {
	if e.Desc == "" {
		return fmt.Sprintf("Conflict: expected folder ID %s, actual %s",
			e.Expected, e.Actual)
	}
	return "MDServerErrorConflictFolderMapping{" + e.Desc + "}"
}

// ToStatus implements the ExportableError interface for MDServerErrorConflictFolderMapping
func (e MDServerErrorConflictFolderMapping) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerErrorConflictFolderMapping
	s.Name = "CONFLICT_FOLDER_MAPPING"
	s.Desc = e.Error()
	return
}

// MDServerErrorTooManyFoldersCreated is returned when a user has created more
// folders than their limit allows.
type MDServerErrorTooManyFoldersCreated struct {
	Created uint64
	Limit   uint64
}

// Error implements the Error interface for MDServerErrorTooManyFoldersCreated.
func (e MDServerErrorTooManyFoldersCreated) Error() string {
	return fmt.Sprintf("Too many folders created. Created: %d, limit: %d",
		e.Created, e.Limit)
}

// ToStatus implements the ExportableError interface for MDServerErrorConflictFolderMapping
func (e MDServerErrorTooManyFoldersCreated) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerErrorTooManyFoldersCreated
	s.Name = "TOO_MANY_FOLDERS_CREATED"
	s.Desc = e.Error()
	s.Fields = []keybase1.StringKVPair{
		{Key: "Limit", Value: strconv.FormatUint(e.Limit, 10)},
		{Key: "Created", Value: strconv.FormatUint(e.Created, 10)},
	}
	return
}

// MDServerErrorCannotReadFinalizedTLF is returned when the client
// isn't authorized to read a finalized TLF.
type MDServerErrorCannotReadFinalizedTLF struct{}

// Error implements the Error interface for
// MDServerErrorCannotReadFinalizedTLF.
func (e MDServerErrorCannotReadFinalizedTLF) Error() string {
	return "MDServerErrorCannotReadFinalizedTLF{}"
}

// ToStatus implements the ExportableError interface for
// MDServerErrorCannotReadFinalizedTLF.
func (e MDServerErrorCannotReadFinalizedTLF) ToStatus() (s keybase1.Status) {
	s.Code = StatusCodeMDServerErrorCannotReadFinalizedTLF
	s.Name = "CANNOT_READ_FINALIZED_TLF"
	s.Desc = e.Error()
	return
}

// MDServerErrorUnwrapper is an implementation of rpc.ErrorUnwrapper
// for errors coming from the MDServer.
type MDServerErrorUnwrapper struct{}

var _ rpc.ErrorUnwrapper = MDServerErrorUnwrapper{}

// MakeArg implements rpc.ErrorUnwrapper for MDServerErrorUnwrapper.
func (eu MDServerErrorUnwrapper) MakeArg() interface{} {
	return &keybase1.Status{}
}

// UnwrapError implements rpc.ErrorUnwrapper for MDServerErrorUnwrapper.
func (eu MDServerErrorUnwrapper) UnwrapError(arg interface{}) (appError error, dispatchError error) {
	s, ok := arg.(*keybase1.Status)
	if !ok {
		return nil, errors.New("Error converting arg to keybase1.Status object in MDServerErrorUnwrapper.UnwrapError")
	}

	if s == nil || s.Code == 0 {
		return nil, nil
	}

	switch s.Code {
	case StatusCodeMDServerError:
		appError = MDServerError{errors.New(s.Desc)}
		break
	case StatusCodeMDServerErrorBadRequest:
		appError = MDServerErrorBadRequest{Reason: s.Desc}
		break
	case StatusCodeMDServerErrorConflictRevision:
		appError = MDServerErrorConflictRevision{Desc: s.Desc}
		break
	case StatusCodeMDServerErrorConflictPrevRoot:
		appError = MDServerErrorConflictPrevRoot{Desc: s.Desc}
		break
	case StatusCodeMDServerErrorConflictDiskUsage:
		appError = MDServerErrorConflictDiskUsage{Desc: s.Desc}
		break
	case StatusCodeMDServerErrorLocked:
		appError = MDServerErrorLocked{}
		break
	case StatusCodeMDServerErrorUnauthorized:
		appError = MDServerErrorUnauthorized{}
		break
	case StatusCodeMDServerErrorThrottle:
		appError = MDServerErrorThrottle{errors.New(s.Desc)}
		break
	case StatusCodeMDServerErrorConditionFailed:
		appError = MDServerErrorConditionFailed{errors.New(s.Desc)}
		break
	case StatusCodeMDServerErrorWriteAccess:
		appError = MDServerErrorWriteAccess{}
		break
	case StatusCodeMDServerErrorConflictFolderMapping:
		appError = MDServerErrorConflictFolderMapping{Desc: s.Desc}
		break
	case StatusCodeMDServerErrorTooManyFoldersCreated:
		err := MDServerErrorTooManyFoldersCreated{}
		for _, f := range s.Fields {
			switch f.Key {
			case "Limit":
				err.Limit, _ = strconv.ParseUint(f.Value, 10, 64)
			case "Created":
				err.Created, _ = strconv.ParseUint(f.Value, 10, 64)
			}
		}
		appError = err
		break
	case StatusCodeMDServerErrorCannotReadFinalizedTLF:
		appError = MDServerErrorCannotReadFinalizedTLF{}
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
