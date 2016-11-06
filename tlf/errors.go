// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import "fmt"

// InvalidIDError indicates that a TLF ID string is not parseable or
// invalid.
type InvalidIDError struct {
	id string
}

func (e InvalidIDError) Error() string {
	return fmt.Sprintf("Invalid TLF ID %q", e.id)
}

// TlfHandleExtensionMismatchError indicates the expected extension
// doesn't match the server's extension for the given handle.
type TlfHandleExtensionMismatchError struct {
	Expected TlfHandleExtension
	// Actual may be nil.
	Actual *TlfHandleExtension
}

// Error implements the error interface for TlfHandleExtensionMismatchError
func (e TlfHandleExtensionMismatchError) Error() string {
	return fmt.Sprintf("Folder handle extension mismatch, "+
		"expected: %s, actual: %s", e.Expected, e.Actual)
}
