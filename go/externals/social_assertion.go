package externals

import (
	"context"
	"strings"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func MakeAssertionContext(mctx libkb.MetaContext) libkb.AssertionContext {
	return libkb.MakeAssertionContext(mctx, NewProofServices(mctx.G()))
}

func NormalizeSocialAssertion(mctx libkb.MetaContext, s string) (keybase1.SocialAssertion, bool) {
	return libkb.NormalizeSocialAssertion(MakeAssertionContext(mctx), s)
}

func IsSocialAssertion(mctx libkb.MetaContext, s string) bool {
	return libkb.IsSocialAssertion(MakeAssertionContext(mctx), s)
}

func AssertionParseAndOnly(mctx libkb.MetaContext, s string) (libkb.AssertionExpression, error) {
	return libkb.AssertionParseAndOnly(MakeAssertionContext(mctx), s)
}

func AssertionParse(mctx libkb.MetaContext, s string) (libkb.AssertionExpression, error) {
	return libkb.AssertionParse(MakeAssertionContext(mctx), s)
}

func ParseAssertionsWithReaders(mctx libkb.MetaContext, s string) (writers, readers []libkb.AssertionExpression, err error) {
	return libkb.ParseAssertionsWithReaders(MakeAssertionContext(mctx), s)
}

func ParseAssertionList(mctx libkb.MetaContext, s string) ([]libkb.AssertionExpression, error) {
	return libkb.ParseAssertionList(MakeAssertionContext(mctx), s)
}

// NOTE The 'Static' methods should only be used in tests or as a basic sanity
// check for the syntactical correctness of an assertion. All other callers
// should use the non-static versions.
// This uses only the 'static' services which exclude any parameterized proofs.
//=============================================================================

type staticAssertionContext struct {
	ctx      context.Context
	services map[string]libkb.ServiceType
}

// MakeStaticAssertionContext returns an AssertionContext that does not require
// access to GlobalContext, but it does not understand parametrized proofs. So
// only static assertions that are hardcoded in the client are valid according
// to this context.
func MakeStaticAssertionContext(ctx context.Context) libkb.AssertionContext {
	services := make(map[string]libkb.ServiceType)
	for _, st := range getStaticProofServices() {
		if !useDevelProofCheckers && st.IsDevelOnly() {
			continue
		}
		services[st.Key()] = st
	}
	return staticAssertionContext{ctx: ctx, services: services}
}

func (a staticAssertionContext) Ctx() context.Context { return a.ctx }

func (a staticAssertionContext) NormalizeSocialName(service string, username string) (string, error) {
	st := a.services[strings.ToLower(service)]
	if st == nil {
		// If we don't know about this service, normalize by going to lowercase
		return strings.ToLower(username), nil
	}
	return st.NormalizeUsername(username)
}

func NormalizeSocialAssertionStatic(ctx context.Context, s string) (keybase1.SocialAssertion, bool) {
	return libkb.NormalizeSocialAssertion(MakeStaticAssertionContext(ctx), s)
}

func AssertionParseAndOnlyStatic(ctx context.Context, s string) (libkb.AssertionExpression, error) {
	return libkb.AssertionParseAndOnly(MakeStaticAssertionContext(ctx), s)
}

//=============================================================================
