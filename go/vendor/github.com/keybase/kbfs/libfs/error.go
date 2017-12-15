// Copyright 2015-2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

// Error defines errors with codes
type Error struct {
	Code    int
	Message string
}

const (
	// InitErrorCode is the error code for initialization errors
	InitErrorCode = 1
	// MountErrorCode is the error code for mount errors
	MountErrorCode = 2
)

// InitError is for initialization errors
func InitError(message string) *Error {
	return &Error{InitErrorCode, message}
}

// MountError is for mount errors
func MountError(message string) *Error {
	return &Error{MountErrorCode, message}
}
