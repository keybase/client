// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
)

var emailRE = regexp.MustCompile(`^\S+@\S+\.\S+$`)
var usernameRE = regexp.MustCompile(`^([a-zA-Z0-9][a-zA-Z0-9_]?)+$`)
var deviceRE = regexp.MustCompile(`^[a-zA-Z0-9][ _'a-zA-Z0-9+-]*$`)
var badDeviceRE = regexp.MustCompile(`  |[ '+_-]$|['+_-][ ]?['+_-]`)

var CheckEmail = Checker{
	F: func(s string) bool {
		return len(s) > 3 && emailRE.MatchString(s)
	},
	Hint: "must be a valid email address",
}

var CheckUsername = Checker{
	F: func(s string) bool {
		return len(s) >= 2 && len(s) <= 16 && usernameRE.MatchString(s)
	},
	Hint: "between 2 and 16 characters long",
}

var CheckEmailOrUsername = Checker{
	F: func(s string) bool {
		return CheckEmail.F(s) || CheckUsername.F(s)
	},
	Hint: "valid usernames are 2-12 letters long",
}

var CheckPassphraseSimple = Checker{
	F: func(s string) bool {
		return len(s) > 0
	},
	Hint: "passphrase cannot be empty",
}

var CheckPassphraseNew = Checker{
	F: func(s string) bool {
		r := []rune(s)
		if len(r) > 0 && unicode.IsSpace(r[0]) {
			return false
		}
		return len(s) >= MinPassphraseLength
	},
	Hint:          fmt.Sprintf("passphrase must be %d or more characters", MinPassphraseLength),
	PreserveSpace: true,
}

var CheckInviteCode = Checker{
	F: func(s string) bool {
		return len(s) > 4
	},
	Hint: "Invite codes are 4 or more characters",
}

var CheckDeviceName = Checker{
	F: func(s string) bool {
		return len(s) >= 3 && len(s) <= 64 && deviceRE.MatchString(s) && !badDeviceRE.MatchString(s)
	},
	Hint: "between 3 and 64 characters long; use a-Z, 0-9, space, plus, underscore, dash and apostrophe",
}

var CheckKex2SecretPhrase = Checker{
	F: func(s string) bool {
		if err := validPhrase(s, Kex2PhraseEntropy); err != nil {
			G.Log.Debug("invalid kex2 phrase: %s", err)
			return false
		}
		return true
	},
	Hint: "It looks like there was a typo in the secret phrase. Please try again.",
}

func IsYes(s string) bool {
	s = strings.ToLower(strings.TrimSpace(s))
	return s == "y" || s == "yes"
}

func IsEmpty(s string) bool {
	return len(strings.TrimSpace(s)) == 0
}

func IsNo(s string) bool {
	s = strings.ToLower(strings.TrimSpace(s))
	return s == "n" || s == "no"
}

var CheckYesNo = Checker{
	F: func(s string) bool {
		return IsYes(s) || IsNo(s)
	},
	Hint: "'yes' or 'no'",
}

var CheckNotEmpty = Checker{
	F: func(s string) bool {
		return len(s) > 0
	},
	Hint: "cannot be empty",
}

type CheckMember struct {
	Set []string
}

func (c CheckMember) Checker() Checker {
	return Checker{
		F: func(s string) bool {
			for _, v := range c.Set {
				if Cicmp(v, s) {
					return true
				}
			}
			return false
		},
		Hint: strings.Join(c.Set, ", "),
	}
}
