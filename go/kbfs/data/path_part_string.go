// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"encoding"
	"encoding/json"
	"fmt"
	"strings"
)

const (
	prefixToSkipObfsucation = ".kbfs_"
	tarGzSuffix             = ".tar.gz"

	// extRestoreMaxLen specifies the max length of an extension, such
	// that it's restored to the obfuscated string.  It includes the
	// leading dot.
	extRestoreMaxLen = 5
)

// PathPartString returns an obfuscated version of part of a path,
// preserving the suffixes if they're small enough or if it's a
// conflicted copy of a file.  Two `PathPartString`s for the asme
// plaintext data, created using the same `Obfuscator`, should pass
// equality checks.
type PathPartString struct {
	plaintext  string
	ext        string
	obsfucator Obfuscator
}

var _ fmt.Stringer = PathPartString{}

// NewPathPartString creates a new `PathPartString` instance, given a
// plaintext string representing one part of a path, and a
// `Obfuscator`.
func NewPathPartString(
	plaintext string, obfuscator Obfuscator) PathPartString {
	_, ext := SplitFileExtension(plaintext)
	if len(ext) > extRestoreMaxLen && ext != tarGzSuffix {
		ext = ""
	}
	conflictedIndex := strings.LastIndex(plaintext, ".conflicted (")
	if conflictedIndex > 0 {
		ext = plaintext[conflictedIndex:]
	}
	return PathPartString{plaintext, ext, obfuscator}
}

func (pps PathPartString) String() string {
	if strings.HasPrefix(pps.plaintext, prefixToSkipObfsucation) {
		return pps.plaintext
	}

	obs := pps.obsfucator.Obfuscate(pps.plaintext)
	return obs + pps.ext
}

// Plaintext returns the plaintext underlying this string part.
func (pps PathPartString) Plaintext() string {
	return pps.plaintext
}

var _ json.Marshaler = PathPartString{}

// MarshalJSON implements the json.Marshaler interface for PathPartString.
func (pps PathPartString) MarshalJSON() ([]byte, error) {
	panic("Cannot marshal PathPartString; use `Plaintext()` instead")
}

var _ encoding.TextMarshaler = PathPartString{}

// MarshalText implements the encoding.TextMarshaler interface for
// PathPartString.
func (pps PathPartString) MarshalText() ([]byte, error) {
	panic("Cannot marshal PathPartString; use `Plaintext()` instead")
}
