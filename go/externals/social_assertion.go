package externals

import (
	"github.com/keybase/client/go/kbname"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func MakeAssertionContext(g *libkb.GlobalContext) kbname.AssertionContext {
	return libkb.MakeAssertionContext(NewProofServices(g))
}

func NormalizeSocialAssertion(g *libkb.GlobalContext, s string) (keybase1.SocialAssertion, bool) {
	return kbname.NormalizeSocialAssertion(MakeAssertionContext(g), s)
}

func IsSocialAssertion(g *libkb.GlobalContext, s string) bool {
	return kbname.IsSocialAssertion(MakeAssertionContext(g), s)
}

func AssertionParseAndOnly(g *libkb.GlobalContext, s string) (kbname.AssertionExpression, error) {
	return kbname.AssertionParseAndOnly(MakeAssertionContext(g), s)
}

func AssertionParse(g *libkb.GlobalContext, s string) (kbname.AssertionExpression, error) {
	return kbname.AssertionParse(MakeAssertionContext(g), s)
}

func ParseAssertionsWithReaders(g *libkb.GlobalContext, s string) (writers, readers []kbname.AssertionExpression, err error) {
	return kbname.ParseAssertionsWithReaders(MakeAssertionContext(g), s)
}

func ParseAssertionList(g *libkb.GlobalContext, s string) ([]kbname.AssertionExpression, error) {
	return kbname.ParseAssertionList(MakeAssertionContext(g), s)
}

// NOTE the static methods should only be used in tests or as a basic sanity
// check for the syntactical correctness of an assertion. All other callers
// should use the non-static versions.
// This uses only the 'static' services which exclude any parameterized proofs.
func makeStaticAssertionContext() kbname.AssertionContext {
	return libkb.MakeStaticAssertionContext(newStaticProofServices())
}

func NormalizeSocialAssertionStatic(s string) (keybase1.SocialAssertion, bool) {
	return kbname.NormalizeSocialAssertion(makeStaticAssertionContext(), s)
}

func AssertionParseAndOnlyStatic(s string) (kbname.AssertionExpression, error) {
	return kbname.AssertionParseAndOnly(makeStaticAssertionContext(), s)
}
