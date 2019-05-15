// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func TestDeletedUsersLoadLookup(t *testing.T) {
	// Similar to TestTeamDelete but much simplier for debugging team loading
	// when a signer is deleted. All user eligible to load the team must also
	// be able to load that deleted user.
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 5)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 5)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)
	cam := ctx.installKeybaseForUser("cam", 5)
	cam.signup()
	divDebug(ctx, "Signed up cam (%s)", cam.username)

	unlogged := ctx.installKeybaseForUser("unl", 5) // do not sign up

	// Team is used to establish relationship between bob and ann, which will
	// allow bob to read ann even after she deletes her account.
	team := ann.createTeam([]*smuUser{bob})
	divDebug(ctx, "team created (%s)", team.name)

	ann.delete()
	divDebug(ctx, "Ann deleted her account")

	bob.primaryDevice().clearUPAKCache()
	bob.loadTeam(team.name, false /* admin */)

	resolveUser := func(user *smuUser, username string) (keybase1.User, libkb.ResolveResult, error) {
		return user.getPrimaryGlobalContext().Resolver.ResolveUser(user.MetaContext(), username)
	}

	// Same with Resolver. user/lookup call there will only succeed if caller
	// is eligible to read that user.
	bob.primaryDevice().clearUPAKCache()
	_, x, err := resolveUser(bob, ann.username)
	require.NoError(t, err)
	require.True(t, x.GetDeleted())

	for _, u := range []*smuUser{cam, unlogged} {
		_, _, err := resolveUser(u, ann.username)
		require.Error(t, err)
		require.IsType(t, libkb.DeletedError{}, err)
	}

	cam.primaryDevice().clearUPAKCache()

	loadUser := func(user *smuUser, uid keybase1.UID) (*keybase1.UserPlusKeysV2AllIncarnations, *libkb.User, error) {
		loadUserArg := libkb.NewLoadUserArg(user.getPrimaryGlobalContext()).
			WithNetContext(context.TODO()).
			WithUID(uid).
			WithPublicKeyOptional().
			WithForcePoll(true)
		return user.getPrimaryGlobalContext().GetUPAKLoader().LoadV2(loadUserArg)
	}

	_, userRes, err := loadUser(bob, ann.uid())
	require.NoError(t, err)
	require.EqualValues(t, libkb.SCDeleted, userRes.GetStatus())

	for _, u := range []*smuUser{cam, unlogged} {
		_, _, err := loadUser(u, ann.uid())
		require.Error(t, err)
		aerr, ok := err.(libkb.AppStatusError)
		require.True(t, ok)
		require.Equal(t, libkb.SCDeleted, aerr.Code)
	}
}
