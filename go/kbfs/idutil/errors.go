// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package idutil

import (
	"fmt"

	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
)

// NoSigChainError means that a user we were trying to identify does
// not have a sigchain.
type NoSigChainError struct {
	User kbname.NormalizedUsername
}

// Error implements the error interface for NoSigChainError.
func (e NoSigChainError) Error() string {
	return fmt.Sprintf("%s has not yet installed Keybase and set up the "+
		"Keybase filesystem. Please ask them to.", e.User)
}

// NoCurrentSessionError indicates that the daemon has no current
// session.  This is basically a wrapper for session.ErrNoSession,
// needed to give the correct return error code to the OS.
type NoCurrentSessionError struct {
}

// Error implements the error interface for NoCurrentSessionError.
func (e NoCurrentSessionError) Error() string {
	return "You are not logged into Keybase.  Try `keybase login`."
}

// NoSuchUserError indicates that the given user couldn't be resolved.
type NoSuchUserError struct {
	Input string
}

// Error implements the error interface for NoSuchUserError
func (e NoSuchUserError) Error() string {
	return fmt.Sprintf("%s is not a Keybase user", e.Input)
}

// ToStatus implements the keybase1.ToStatusAble interface for NoSuchUserError
func (e NoSuchUserError) ToStatus() keybase1.Status {
	return keybase1.Status{
		Name: "NotFound",
		Code: int(keybase1.StatusCode_SCNotFound),
		Desc: e.Error(),
	}
}

// NoSuchTeamError indicates that the given team couldn't be resolved.
type NoSuchTeamError struct {
	Input string
}

// Error implements the error interface for NoSuchTeamError
func (e NoSuchTeamError) Error() string {
	return fmt.Sprintf("%s is not a Keybase team", e.Input)
}

// TlfNameNotCanonical indicates that a name isn't a canonical, and
// that another (not necessarily canonical) name should be tried.
type TlfNameNotCanonical struct {
	Name, NameToTry string
}

// Error implements the error interface for TlfNameNotCanonical.
func (e TlfNameNotCanonical) Error() string {
	return fmt.Sprintf("TLF name %s isn't canonical: try %s instead",
		e.Name, e.NameToTry)
}

// NoSuchNameError indicates that the user tried to access a
// subdirectory entry that doesn't exist.
type NoSuchNameError struct {
	Name      string
	NameToLog string
}

// Error implements the error interface for NoSuchNameError
func (e NoSuchNameError) Error() string {
	n := e.Name
	if len(e.NameToLog) > 0 {
		n = e.NameToLog
	}
	return fmt.Sprintf("%s doesn't exist", n)
}

// BadTLFNameError indicates a top-level folder name that has an
// incorrect format.
type BadTLFNameError struct {
	Name      string
	NameToLog string
}

// Error implements the error interface for BadTLFNameError.
func (e BadTLFNameError) Error() string {
	n := e.Name
	if len(e.NameToLog) > 0 {
		n = e.NameToLog
	}
	return fmt.Sprintf("TLF name %s is in an incorrect format", n)
}
