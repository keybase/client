// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"github.com/keybase/client/go/kbun"
)

var emailRE = regexp.MustCompile(`^\S+@\S+\.\S+$`)

// Also used in shared/signup/device-name/index.tsx
var deviceRE = regexp.MustCompile(`^[a-zA-Z0-9][ _'a-zA-Z0-9+‘’—–-]*$`)
var badDeviceRE = regexp.MustCompile(`  |[ '_-]$|['_-][ ]?['_-]`)
var normalizeDeviceRE = regexp.MustCompile(`[^a-zA-Z0-9]`)

var CheckEmail = Checker{
	F: func(s string) bool {
		return len(s) > 3 && emailRE.MatchString(s)
	},
	Hint: "must be a valid email address",
}

var CheckUsername = Checker{
	F:    kbun.CheckUsername,
	Hint: "between 2 and 16 characters long",
}

var CheckEmailOrUsername = Checker{
	F: func(s string) bool {
		return CheckEmail.F(s) || CheckUsername.F(s)
	},
	Hint: "valid usernames are 2-16 letters long",
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

func normalizeDeviceName(s string) string {
	return strings.ToLower(normalizeDeviceRE.ReplaceAllString(s, ""))
}

var CheckDeviceName = Checker{
	F: func(s string) bool {
		normalized := normalizeDeviceName(s)

		return len(normalized) >= 3 &&
			len(normalized) <= 64 &&
			deviceRE.MatchString(s) &&
			!badDeviceRE.MatchString(s)
	},
	Transform: func(s string) string {
		s = strings.Replace(s, "—", "-", -1) // em dash
		s = strings.Replace(s, "–", "-", -1) // en dash
		s = strings.Replace(s, "‘", "'", -1) // curly quote #1
		s = strings.Replace(s, "’", "'", -1) // curly quote #2
		return s
	},
	Normalize: func(s string) string {
		return normalizeDeviceName(s)
	},
	Hint: "between 3 and 64 characters long; use a-Z, 0-9, space, plus, underscore, dash and apostrophe",
}

func MakeCheckKex2SecretPhrase(g *GlobalContext) Checker {
	return Checker{
		F: func(s string) bool {
			if err := validPhrase(s, []int{Kex2PhraseEntropy, Kex2PhraseEntropy2}); err != nil {
				g.Log.Debug("invalid kex2 phrase: %s", err)
				return false
			}
			return true
		},
		Hint: "Wrong secret phrase. Please try again.",
	}
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
