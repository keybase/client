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
	prefixFileInfo          = ".kbfs_fileinfo_"
	suffixConflictStart     = ".conflicted ("
	tarGzSuffix             = ".tar.gz"

	// extRestoreMaxLen specifies the max length of an extension, such
	// that it's restored to the obfuscated string.  It includes the
	// leading dot.
	extRestoreMaxLen = 5
)

// PathPartString returns an obfuscated version of part of a path,
// preserving the suffixes if they're small enough or if it's a
// conflicted copy of a file.  Two `PathPartString`s for the same
// plaintext data, created using the same `Obfuscator`, should pass
// equality checks.
type PathPartString struct {
	plaintext   string
	toObfuscate string // if different from `plaintext`
	ext         string
	obfuscator  Obfuscator
}

var _ fmt.Stringer = PathPartString{}

// NewPathPartString creates a new `PathPartString` instance, given a
// plaintext string representing one part of a path, and a
// `Obfuscator`.
func NewPathPartString(
	plaintext string, obfuscator Obfuscator) PathPartString {
	var toObfuscate string
	_, ext := SplitFileExtension(plaintext)
	// Treat the long tarball suffix specially, since it's already
	// parsed specially by `SplitFileExtension`.  Otherwise, strictly
	// filter for length, so we don't accidentally expose suffixes
	// that aren't common file suffixes, but instead part of the
	// actual privately-named file (e.g., "this.file.is.secret").
	if len(ext) > extRestoreMaxLen && ext != tarGzSuffix {
		ext = ""
	}

	if strings.HasPrefix(plaintext, prefixFileInfo) {
		toObfuscate = strings.TrimPrefix(plaintext, prefixFileInfo)
	}

	conflictedIndex := strings.LastIndex(plaintext, suffixConflictStart)
	if conflictedIndex > 0 {
		// If this is a conflict file, we should obfuscate everything
		// besides the conflict part, to get a string that matches the
		// non-conflict portion.  (Also continue to ignore any file
		// info prefix when obfuscating, as above.)
		if len(toObfuscate) == 0 {
			toObfuscate = plaintext
		}
		toObfuscate = toObfuscate[:strings.LastIndex(
			toObfuscate, suffixConflictStart)] + ext
		ext = plaintext[conflictedIndex:]
	}
	return PathPartString{plaintext, toObfuscate, ext, obfuscator}
}

func (pps PathPartString) String() string {
	if pps.obfuscator == nil {
		return pps.plaintext
	}

	var prefix string
	if strings.HasPrefix(pps.plaintext, prefixFileInfo) {
		// Preserve the fileinfo prefix.
		prefix = prefixFileInfo
	} else if strings.HasPrefix(pps.plaintext, prefixToSkipObfsucation) {
		// Ignore any other .kbfs_ prefixed files.
		return pps.plaintext
	}

	toObfuscate := pps.plaintext
	if len(pps.toObfuscate) > 0 {
		toObfuscate = pps.toObfuscate
	}

	ob := pps.obfuscator.Obfuscate(toObfuscate)
	return prefix + ob + pps.ext
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
