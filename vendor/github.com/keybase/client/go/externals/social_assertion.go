package externals

import (
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func MakeAssertionContext() libkb.AssertionContext {
	return libkb.MakeAssertionContext(GetServices())
}

func NormalizeSocialAssertion(s string) (keybase1.SocialAssertion, bool) {
	return libkb.NormalizeSocialAssertion(MakeAssertionContext(), s)
}

func IsSocialAssertion(s string) bool {
	return libkb.IsSocialAssertion(MakeAssertionContext(), s)
}

func AssertionParseAndOnly(s string) (libkb.AssertionExpression, error) {
	return libkb.AssertionParseAndOnly(MakeAssertionContext(), s)
}

func AssertionParse(s string) (libkb.AssertionExpression, error) {
	return libkb.AssertionParse(MakeAssertionContext(), s)
}
