package externals

import (
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func MakeAssertionContext(g *libkb.GlobalContext) libkb.AssertionContext {
	return libkb.MakeAssertionContext(NewProofServices(g))
}

func NormalizeSocialAssertion(g *libkb.GlobalContext, s string) (keybase1.SocialAssertion, bool) {
	return libkb.NormalizeSocialAssertion(MakeAssertionContext(g), s)
}

func IsSocialAssertion(g *libkb.GlobalContext, s string) bool {
	return libkb.IsSocialAssertion(MakeAssertionContext(g), s)
}

func AssertionParseAndOnly(g *libkb.GlobalContext, s string) (libkb.AssertionExpression, error) {
	return libkb.AssertionParseAndOnly(MakeAssertionContext(g), s)
}

func AssertionParse(g *libkb.GlobalContext, s string) (libkb.AssertionExpression, error) {
	return libkb.AssertionParse(MakeAssertionContext(g), s)
}

func ParseAssertionsWithReaders(g *libkb.GlobalContext, s string) (writers, readers []libkb.AssertionExpression, err error) {
	return libkb.ParseAssertionsWithReaders(MakeAssertionContext(g), s)
}

func ParseAssertionList(g *libkb.GlobalContext, s string) ([]libkb.AssertionExpression, error) {
	return libkb.ParseAssertionList(MakeAssertionContext(g), s)
}

// NOTE the static methods should only be used in tests or as a basic sanity
// check for the syntactical correctness of an assertion. All other callers
// should use the non-static versions.
// This uses only the 'static' services which exclude any parameterized proofs.
func MakeStaticAssertionContext() libkb.AssertionContext {
	return libkb.MakeStaticAssertionContext(NewStaticProofServices())
}

func NormalizeSocialAssertionStatic(s string) (keybase1.SocialAssertion, bool) {
	return libkb.NormalizeSocialAssertion(MakeStaticAssertionContext(), s)
}

func AssertionParseAndOnlyStatic(s string) (libkb.AssertionExpression, error) {
	return libkb.AssertionParseAndOnly(MakeStaticAssertionContext(), s)
}
