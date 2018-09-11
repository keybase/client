// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package teams

import (
	"context"
	"sort"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func createUserAndRootTeam(t *testing.T) (fu *kbtest.FakeUser, nm keybase1.TeamName, g *libkb.GlobalContext, cleanup func()) {
	tc := SetupTest(t, "team", 1)
	cleanup = func() { tc.Cleanup() }

	// Note that the length limit for a team name, with the additional suffix
	// below, is 16 characters. We have 5 to play with, including the implicit
	// underscore after the prefix.
	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	teamName := u.Username + "t"

	_, err = CreateRootTeam(context.TODO(), tc.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)

	nm, err = keybase1.TeamNameFromString(teamName)
	require.NoError(t, err)
	require.Equal(t, nm.String(), teamName)

	return u, nm, tc.G, cleanup
}

func TestCreateTeam(t *testing.T) {
	_, _, _, cleanup := createUserAndRootTeam(t)
	cleanup()
}

func TestCreateTeamAfterAccountReset(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	// Note that the length limit for a team name, with the additional suffix
	// below, is 16 characters. We have 5 to play with, including the implicit
	// underscore after the prefix.
	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	// Now the user's fully qualified username should be like user%seqno. If we
	// don't format this properly, the server will reject the post.
	kbtest.ResetAccount(tc, u)

	// this will reprovision as an eldest device:
	err = u.Login(tc.G)
	require.NoError(t, err)
	if err = kbtest.AssertProvisioned(tc); err != nil {
		t.Fatal(err)
	}

	teamName := u.Username + "T"
	_, err = CreateRootTeam(context.TODO(), tc.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)
}

func TestCreateSubteam(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	parentTeamName, err := keybase1.TeamNameFromString(u.Username + "T")
	require.NoError(t, err)
	_, err = CreateRootTeam(context.TODO(), tc.G, parentTeamName.String(), keybase1.TeamSettings{})
	require.NoError(t, err)

	subteamBasename := "mysubteam"
	_, err = CreateSubteam(context.TODO(), tc.G, subteamBasename, parentTeamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	// Fetch the subteam we just created, to make sure it's there.
	subteamFQName, err := parentTeamName.Append(subteamBasename)
	require.NoError(t, err)
	subteam, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name: subteamFQName.String(),
	})
	require.NoError(t, err)
	require.Equal(t, subteamFQName, subteam.Name())
	require.Equal(t, keybase1.Seqno(1), subteam.chain().GetLatestSeqno())

	// creator of subteam should *not* be a member of the subteam, they
	// need to explicitly ask to create it with themself in it.
	assertRole(tc, subteamFQName.String(), u.Username, keybase1.TeamRole_NONE)

	// Test joining with addSelf=true

	subteamBasename = "mysubteam2"
	_, err = CreateSubteam(context.TODO(), tc.G, subteamBasename, parentTeamName, keybase1.TeamRole_ADMIN /* addSelfAs */)
	require.NoError(t, err)

	subteamFQName, err = parentTeamName.Append(subteamBasename)
	require.NoError(t, err)
	assertRole(tc, subteamFQName.String(), u.Username, keybase1.TeamRole_ADMIN)
}

func TestCreateSubSubteam(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	parentTeamName, err := keybase1.TeamNameFromString(u.Username + "T")
	require.NoError(t, err)
	_, err = CreateRootTeam(context.TODO(), tc.G, parentTeamName.String(), keybase1.TeamSettings{})
	require.NoError(t, err)

	subteamBasename := "bbb"
	_, err = CreateSubteam(context.TODO(), tc.G, subteamBasename, parentTeamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)
	subteamName, err := parentTeamName.Append(subteamBasename)
	require.NoError(t, err)

	assertRole(tc, subteamName.String(), u.Username, keybase1.TeamRole_NONE)

	subsubteamBasename := "ccc"
	_, err = CreateSubteam(context.TODO(), tc.G, subsubteamBasename, subteamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	subsubteamName, err := parentTeamName.Append(subteamBasename)
	require.NoError(t, err)

	assertRole(tc, subsubteamName.String(), u.Username, keybase1.TeamRole_NONE)
}

func TestCreateImplicitTeam(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	numKBUsers := 3
	var users []*kbtest.FakeUser
	var uvs []keybase1.UserVersion
	var impTeam keybase1.ImplicitTeamDisplayName
	for i := 0; i < numKBUsers; i++ {
		u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
		require.NoError(t, err)
		users = append(users, u)
	}

	// Simple imp team
	for _, u := range users {
		impTeam.Writers.KeybaseUsers = append(impTeam.Writers.KeybaseUsers, u.Username)
		uvs = append(uvs, u.User.ToUserVersion())
	}
	sort.Sort(keybase1.ByUserVersionID(uvs))
	impTeam.IsPublic = false
	teamID, _, err := CreateImplicitTeam(context.TODO(), tc.G, impTeam)
	require.NoError(t, err)
	team, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.Equal(t, team.ID, teamID)
	members, err := team.Members()
	require.NoError(t, err)
	sort.Sort(keybase1.ByUserVersionID(members.Owners))
	require.Equal(t, members.Owners, uvs)

	// Imp team with invites
	impTeam.Writers.UnresolvedUsers = []keybase1.SocialAssertion{
		keybase1.SocialAssertion{
			User:    "mike",
			Service: keybase1.SocialAssertionService("twitter"),
		},
		keybase1.SocialAssertion{
			User:    "mike",
			Service: keybase1.SocialAssertionService("github"),
		},
	}
	teamID, _, err = CreateImplicitTeam(context.TODO(), tc.G, impTeam)
	require.NoError(t, err)
	team, err = Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	members, err = team.Members()
	require.NoError(t, err)
	sort.Sort(keybase1.ByUserVersionID(members.Owners))
	require.Equal(t, members.Owners, uvs)
	chainInvites := team.chain().inner.ActiveInvites
	require.Equal(t, 2, len(chainInvites))
}
