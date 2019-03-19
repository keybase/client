// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlfhandle

import (
	"fmt"

	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
)

// NoSuchNameError indicates that the user tried to access a TLF that
// doesn't exist.
type NoSuchNameError struct {
	Name string
}

// Error implements the error interface for NoSuchNameError
func (e NoSuchNameError) Error() string {
	return fmt.Sprintf("%s doesn't exist", e.Name)
}

// HandleFinalizedError is returned when something attempts to modify
// a finalized TLF handle.
type HandleFinalizedError struct {
}

// Error implements the error interface for HandleFinalizedError.
func (e HandleFinalizedError) Error() string {
	return "Attempt to modify finalized TLF handle"
}

// HandleMismatchError indicates an inconsistent or unverifiable MD object
// for the given top-level folder.
type HandleMismatchError struct {
	Revision kbfsmd.Revision
	Dir      string
	TlfID    tlf.ID
	Err      error
}

// Error implements the error interface for HandleMismatchError
func (e HandleMismatchError) Error() string {
	return fmt.Sprintf("Could not verify metadata (revision=%d) for directory %s (id=%s): %s",
		e.Revision, e.Dir, e.TlfID, e.Err)
}

// ReadAccessError indicates that the user tried to read from a
// top-level folder without read permission.
type ReadAccessError struct {
	User     kbname.NormalizedUsername
	Filename string
	Tlf      tlf.CanonicalName
	Type     tlf.Type
}

// Error implements the error interface for ReadAccessError
func (e ReadAccessError) Error() string {
	return fmt.Sprintf("%s does not have read access to directory %s",
		e.User, BuildCanonicalPathForTlfName(e.Type, e.Tlf))
}

// NewReadAccessError constructs a ReadAccessError for the given
// directory and user.
func NewReadAccessError(h *Handle, username kbname.NormalizedUsername, filename string) error {
	tlfname := h.GetCanonicalName()
	return ReadAccessError{
		User:     username,
		Filename: filename,
		Tlf:      tlfname,
		Type:     h.Type(),
	}
}

// WriteAccessError indicates an error when trying to write a file
type WriteAccessError struct {
	User     kbname.NormalizedUsername
	Filename string
	Tlf      tlf.CanonicalName
	Type     tlf.Type
}

// Error implements the error interface for WriteAccessError
func (e WriteAccessError) Error() string {
	if e.Tlf != "" {
		return fmt.Sprintf("%s does not have write access to directory %s",
			e.User, BuildCanonicalPathForTlfName(e.Type, e.Tlf))
	}
	return fmt.Sprintf("%s does not have write access to %s", e.User, e.Filename)
}

// NewWriteAccessError is an access error trying to write a file
func NewWriteAccessError(h *Handle, username kbname.NormalizedUsername, filename string) error {
	tlfName := tlf.CanonicalName("")
	t := tlf.Private
	if h != nil {
		tlfName = h.GetCanonicalName()
		t = h.Type()
	}
	return WriteAccessError{
		User:     username,
		Filename: filename,
		Tlf:      tlfName,
		Type:     t,
	}
}
