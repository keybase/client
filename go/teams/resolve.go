package teams

import (
	"context"
	"fmt"
	"strings"

	"golang.org/x/sync/errgroup"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// ResolveIDToName takes a team ID and resolves it to a name.
// It can use server-assist but always cryptographically checks the result.
func ResolveIDToName(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (name keybase1.TeamName, err error) {
	rres := g.Resolver.ResolveFullExpression(ctx, fmt.Sprintf("tid:%s", id))
	if err = rres.GetError(); err != nil {
		return keybase1.TeamName{}, err
	}
	name = rres.GetTeamName()
	err = g.GetTeamLoader().VerifyTeamName(ctx, id, name)
	if err != nil {
		return keybase1.TeamName{}, err
	}

	return name, nil
}

// ResolveNameToID takes a team name and resolves it to a team ID.
// It can use server-assist but always cryptographically checks the result.
func ResolveNameToID(ctx context.Context, g *libkb.GlobalContext, name keybase1.TeamName) (id keybase1.TeamID, err error) {
	rres := g.Resolver.ResolveFullExpression(ctx, fmt.Sprintf("team:%s", name))
	if err = rres.GetError(); err != nil {
		return keybase1.TeamID(""), err
	}
	id = rres.GetTeamID()

	err = g.GetTeamLoader().VerifyTeamName(ctx, id, name)
	if err != nil {
		return keybase1.TeamID(""), err
	}

	return id, nil
}

// Resolve assertions in an implicit team display name and verify the result.
// Resolve an implicit team name with assertions like "alice,bob+bob@twitter#char (conflicted 2017-03-04 #1)"
// Into "alice,bob#char (conflicted 2017-03-04 #1)"
// The input can contain compound assertions, but if compound assertions are left unresolved, an error will be returned.
func ResolveImplicitTeamDisplayName(ctx context.Context, g *libkb.GlobalContext,
	name string, public bool) (res keybase1.ImplicitTeamDisplayName, err error) {

	defer g.CTraceTimed(ctx, fmt.Sprintf("ResolveImplicitTeamDisplayName(%v, public:%v)", name, public), func() error { return err })()

	split1 := strings.SplitN(name, " ", 2) // split1: [assertions, ?conflict]
	assertions := split1[0]
	var suffix string
	if len(split1) > 1 {
		suffix = split1[1]
	}

	writerAssertions, readerAssertions, err := externals.ParseAssertionsWithReaders(assertions)
	if err != nil {
		return res, err
	}

	res = keybase1.ImplicitTeamDisplayName{
		IsPublic: public,
	}
	if len(suffix) > 0 {
		res.ConflictInfo, err = libkb.ParseImplicitTeamDisplayNameSuffix(suffix)
		if err != nil {
			return res, err
		}
	}

	var resolvedAssertions []libkb.ResolvedAssertion

	err = ResolveImplicitTeamSetUntrusted(ctx, g, writerAssertions, &res.Writers, &resolvedAssertions)
	if err != nil {
		return res, err
	}
	err = ResolveImplicitTeamSetUntrusted(ctx, g, readerAssertions, &res.Readers, &resolvedAssertions)
	if err != nil {
		return res, err
	}

	deduplicateImplicitTeamDisplayName(&res)

	// errgroup collects errors and returns the first non-nil.
	// subctx is canceled when the group finishes.
	group, subctx := errgroup.WithContext(ctx)

	// Identify everyone who resolved in parallel, checking that they match their resolved UID and original assertions.
	for _, resolvedAssertion := range resolvedAssertions {
		resolvedAssertion := resolvedAssertion // https://golang.org/doc/faq#closures_and_goroutines
		group.Go(func() error {
			return verifyResolveResult(subctx, g, resolvedAssertion)
		})
	}

	err = group.Wait()
	return res, err
}

// Try to resolve implicit team members.
// Modifies the arguments `resSet` and appends to `resolvedAssertions`.
// For each assertion in `sourceAssertions`, try to resolve them.
//   If they resolve, add the username to `resSet` and the assertion to `resolvedAssertions`.
//   If they don't resolve, add the SocialAssertion to `resSet`, but nothing to `resolvedAssertions`.
func ResolveImplicitTeamSetUntrusted(ctx context.Context, g *libkb.GlobalContext,
	sourceAssertions []libkb.AssertionExpression, resSet *keybase1.ImplicitTeamUserSet, resolvedAssertions *[]libkb.ResolvedAssertion) error {

	for _, expr := range sourceAssertions {
		u, err := g.Resolver.ResolveUser(ctx, expr.String())
		if err != nil {
			// Resolution failed. Could still be an SBS assertion.
			sa, err := expr.ToSocialAssertion()
			if err != nil {
				// Could not convert to a social assertion.
				// This could be because it is a compound assertion, which we do not support when SBS.
				// Or it could be because it's a team assertion or something weird like that.
				return err
			}
			resSet.UnresolvedUsers = append(resSet.UnresolvedUsers, sa)
		} else {
			// Resolution succeeded
			resSet.KeybaseUsers = append(resSet.KeybaseUsers, u.Username)
			// Append the resolvee and assertion to resolvedAssertions, in case we identify later.
			*resolvedAssertions = append(*resolvedAssertions, libkb.ResolvedAssertion{
				UID:       u.Uid,
				Assertion: expr,
			})
		}
	}
	return nil
}

// Verify using Identify that a UID matches an assertion.
func verifyResolveResult(ctx context.Context, g *libkb.GlobalContext, resolvedAssertion libkb.ResolvedAssertion) (err error) {

	defer g.CTrace(ctx, fmt.Sprintf("verifyResolveResult ID user [%s] %s", resolvedAssertion.UID, resolvedAssertion.Assertion.String()),
		func() error { return err })()

	// TODO it might be worth short-circuiting on local assertions. Because Identify might try and go do a bunch of remote proofs
	// that aren't relevant.

	id2arg := keybase1.Identify2Arg{
		Uid:           resolvedAssertion.UID,
		UserAssertion: resolvedAssertion.Assertion.String(),
		CanSuppressUI: true,
		// Use CHAT_GUI to avoid tracker popups and DO externals checks.
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI,
	}

	engCtx := engine.Context{
		// Send a nil IdentifyUI, this IdentifyBehavior should not use it anyway.
		IdentifyUI: nil,
		NetContext: ctx,
	}

	eng := engine.NewIdentify2WithUID(g, &id2arg)
	err = engine.RunEngine(eng, &engCtx)
	if err != nil {
		idRes := eng.Result()
		g.Log.CDebugf(ctx, "identify failed (IDres %v, TrackBreaks %v): %v", idRes != nil, idRes != nil && idRes.TrackBreaks != nil, err)
	}
	return err
}

// Remove duplicates from a team display name.
// Does not do any resolution nor resolution of UIDs.
// "alice" -> "alice"
// "alice,bob,alice" -> "alice"
// "alice#alice" -> "alice"
// "alice,bob#alice#char" -> "alice,bob#char"
func deduplicateImplicitTeamDisplayName(name *keybase1.ImplicitTeamDisplayName) {
	seen := make(map[string]bool)

	unseen := func(idx string) bool {
		seenBefore := seen[idx]
		seen[idx] = true
		return !seenBefore
	}

	var writers keybase1.ImplicitTeamUserSet
	var readers keybase1.ImplicitTeamUserSet

	for _, u := range name.Writers.KeybaseUsers {
		if unseen(u) {
			writers.KeybaseUsers = append(writers.KeybaseUsers, u)
		}
	}
	for _, u := range name.Writers.UnresolvedUsers {
		if unseen(u.String()) {
			writers.UnresolvedUsers = append(writers.UnresolvedUsers, u)
		}
	}
	for _, u := range name.Readers.KeybaseUsers {
		if unseen(u) {
			readers.KeybaseUsers = append(readers.KeybaseUsers, u)
		}
	}
	for _, u := range name.Readers.UnresolvedUsers {
		if unseen(u.String()) {
			readers.UnresolvedUsers = append(readers.UnresolvedUsers, u)
		}
	}

	name.Writers = writers
	name.Readers = readers
}
