package externals

import (
	"strings"

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

// NOTE The 'Static' methods should only be used in tests or as a basic sanity
// check for the syntactical correctness of an assertion. All other callers
// should use the non-static versions.
// This uses only the 'static' services which exclude any parameterized proofs.
//=============================================================================

type staticAssertionContext struct {
	services map[string]libkb.ServiceType
}

func makeStaticAssertionContext() libkb.AssertionContext {
	services := make(map[string]libkb.ServiceType)
	for _, st := range getStaticProofServices() {
		if !useDevelProofCheckers && st.IsDevelOnly() {
			continue
		}
		services[st.Key()] = st
	}
	return staticAssertionContext{services: services}
}

func (a staticAssertionContext) NormalizeSocialName(service string, username string) (string, error) {
	st := a.services[strings.ToLower(service)]
	if st == nil {
		// If we don't know about this service, normalize by going to lowercase
		return strings.ToLower(username), nil
	}
	return st.NormalizeUsername(username)
}

func NormalizeSocialAssertionStatic(s string) (keybase1.SocialAssertion, bool) {
	return libkb.NormalizeSocialAssertion(makeStaticAssertionContext(), s)
}

func AssertionParseAndOnlyStatic(s string) (libkb.AssertionExpression, error) {
	return libkb.AssertionParseAndOnly(makeStaticAssertionContext(), s)
}

//=============================================================================
