package libkb

import (
	"encoding/hex"
	"regexp"
	"strings"
	"unicode"
)

var CheckEmail = Checker{
	F: func(s string) bool {
		re := regexp.MustCompile(`^\S+@\S+\.\S+$`)
		return len(s) > 3 && re.MatchString(s)
	},
	Hint: "must be a valid email address",
}

var CheckUsername = Checker{
	F: func(s string) bool {
		re := regexp.MustCompile(`^([a-z0-9][a-z0-9_]?)+$`)
		return len(s) >= 2 && len(s) <= 16 && re.MatchString(s)
	},
	Hint: "between 2 and 16 characters long",
}

var CheckEmailOrUsername = Checker{
	F: func(s string) bool {
		return CheckEmail.F(s) || CheckUsername.F(s)
	},
	Hint: "valid usernames are 2-12 letters long",
}

var CheckPasswordSimple = Checker{
	F: func(s string) bool {
		return len(s) > 0
	},
	Hint: "passphrase cannot be empty",
}
var CheckNewPassword = Checker{

	F: func(s string) bool {
		r := []rune(s)
		if len(r) > 0 && unicode.IsSpace(r[0]) {
			return false
		} else {
			return len(s) >= 12
		}
	},
	Hint:          "passphrase must be 12 or more characters",
	PreserveSpace: true,
}

var CheckInviteCode = Checker{
	F: func(s string) bool {
		if b, err := hex.DecodeString(s); err != nil {
			return false
		} else {
			return len(b) == 12
		}
	},
	Hint: "Invite codes are 24-digit hex strings",
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
