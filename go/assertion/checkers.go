// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package assertion

import "regexp"

var usernameRE = regexp.MustCompile(`^([a-zA-Z0-9][a-zA-Z0-9_]?)+$`)

type Checker struct {
	F             func(string) bool
	Hint          string
	PreserveSpace bool
}

var CheckUsername = Checker{
	F: func(s string) bool {
		return len(s) >= 2 && len(s) <= 16 && usernameRE.MatchString(s)
	},
	Hint: "between 2 and 16 characters long",
}
