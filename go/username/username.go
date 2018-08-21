// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package username

import (
	"regexp"
	"strings"
)

// Underscores allowed, just not first or doubled.
var usernameRE = regexp.MustCompile(`^([a-zA-Z0-9]+_?)+$`)

// CheckUsername returns true if the given string can be a Keybase
// username.
func CheckUsername(s string) bool {
	return len(s) >= 2 && len(s) <= 16 && usernameRE.MatchString(s)
}

// InvalidUsernameError is returned when an invalid Keybase username
// is encountered.
type InvalidUsernameError struct {
	Username string
}

func (e InvalidUsernameError) Error() string {
	return "Bad username: '" + e.Username + "'"
}

// NormalizedUsername is a Keybase username that has been normalized
// (toLowered) and therefore will compare correctly against other
// normalized usernames.
type NormalizedUsername string

// NewNormalizedUsername makes a normalized username out of a non-normalized
// plain string username
func NewNormalizedUsername(s string) NormalizedUsername {
	return NormalizedUsername(strings.ToLower(s))
}

// Eq returns true if the given normalized usernames are equal
func (n NormalizedUsername) Eq(n2 NormalizedUsername) bool {
	return string(n) == string(n2)
}

// String returns the normalized username as a string (in lower case)
func (n NormalizedUsername) String() string { return string(n) }

// IsNil returns true if the username is the empty string
func (n NormalizedUsername) IsNil() bool { return len(string(n)) == 0 }

// CheckValid returns nil if the username is valid, and
// InvalidUsernameError otherwise.
func (n NormalizedUsername) CheckValid() error {
	s := n.String()
	if !CheckUsername(s) {
		return InvalidUsernameError{s}
	}
	return nil
}
