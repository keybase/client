package libkb

import (
	"regexp"
)

type Checker struct {
	F    func(string) bool
	Hint string
}

var CheckEmail = Checker{
	F: func(s string) bool {
		re := regexp.MustCompile(`^\S+@\S+\.\S+$`)
		return len(s) > 3 && re.MatchString(s)
	},
	Hint: "must be a valid email address",
}

var CheckUsername = Checker{
	F: func(s string) bool {
		return len(s) >= 2 && len(s) <= 16
	},
	Hint: "between 2 and 16 characters long",
}

var CheckEmailOrUsername = Checker{
	F: func(s string) bool {
		return CheckEmail.F(s) || CheckUsername.F(s)
	},
	Hint: "valid usernames are 4-12 letters long",
}
