// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfshash

import "fmt"

// InvalidHashError is returned whenever an invalid hash is
// detected.
type InvalidHashError struct {
	H Hash
}

func (e InvalidHashError) Error() string {
	return fmt.Sprintf("Invalid hash %s", e.H)
}

// UnknownHashTypeError is returned whenever a hash with an unknown
// hash type is attempted to be used for verification.
type UnknownHashTypeError struct {
	T HashType
}

func (e UnknownHashTypeError) Error() string {
	return fmt.Sprintf("Unknown hash type %s", e.T)
}

// HashMismatchError is returned whenever a hash mismatch is detected.
type HashMismatchError struct {
	ExpectedH Hash
	ActualH   Hash
}

func (e HashMismatchError) Error() string {
	return fmt.Sprintf("Hash mismatch: expected %s, got %s",
		e.ExpectedH, e.ActualH)
}
