package teams

import (
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestFastLoaderBasic(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	t.Logf("create a team")
	teamName, teamID := createTeam2(tc)

	t.Logf("load the team")
	arg := keybase1.FastTeamLoadArg{
		ID:            teamID,
		Applications:  []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		NeedLatestKey: true,
	}
	m := libkb.NewMetaContextForTest(tc)
	team, err := tc.G.GetFastTeamLoader().Load(m, arg)
	require.NoError(t, err)
	require.Equal(t, len(team.ApplicationKeys), 1)
	require.True(t, teamName.Eq(team.Name))

	t.Logf("load the team again")
	team, err = tc.G.GetFastTeamLoader().Load(m, arg)
	require.NoError(t, err)
	require.Equal(t, len(team.ApplicationKeys), 1)
	require.True(t, teamName.Eq(team.Name))
}

// Test fast loading a team that does several key rotations.
func TestFastLoaderKeyGen(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])
	m := make([]libkb.MetaContext, 2)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER)
	require.NoError(t, err)

	t.Logf("B's first load at gen 1")
	arg := keybase1.FastTeamLoadArg{
		ID:            teamID,
		Applications:  []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		NeedLatestKey: true,
	}
	team, err := tcs[1].G.GetFastTeamLoader().Load(m[1], arg)
	require.NoError(t, err)
	require.Equal(t, len(team.ApplicationKeys), 1)
	require.Equal(t, team.ApplicationKeys[0].KeyGeneration, keybase1.PerTeamKeyGeneration(1))
	require.True(t, teamName.Eq(team.Name))

	t.Logf("rotate the key a bunch of times")
	// Rotate the key by removing and adding B from the team
	for i := 0; i < 3; i++ {
		err = RemoveMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username)
		require.NoError(t, err)

		_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER)
		require.NoError(t, err)
	}

	t.Logf("load as A to check the progression")
	team, err = tcs[0].G.GetFastTeamLoader().Load(m[0], arg)
	require.NoError(t, err)
	require.Equal(t, len(team.ApplicationKeys), 1)
	require.Equal(t, team.ApplicationKeys[0].KeyGeneration, keybase1.PerTeamKeyGeneration(4))
	require.True(t, teamName.Eq(team.Name))

	t.Logf("B loads the new PTK by number")
	arg.NeedLatestKey = false
	arg.KeyGenerationsNeeded = []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(4)}
	team, err = tcs[1].G.GetFastTeamLoader().Load(m[1], arg)
	require.Equal(t, len(team.ApplicationKeys), 1)
	require.Equal(t, team.ApplicationKeys[0].KeyGeneration, keybase1.PerTeamKeyGeneration(4))
	require.True(t, teamName.Eq(team.Name))

	t.Logf("B loads the new PTK by latest")
	arg.NeedLatestKey = true
	arg.KeyGenerationsNeeded = []keybase1.PerTeamKeyGeneration{}
	team, err = tcs[1].G.GetFastTeamLoader().Load(m[1], arg)
	require.Equal(t, len(team.ApplicationKeys), 1)
	require.Equal(t, team.ApplicationKeys[0].KeyGeneration, keybase1.PerTeamKeyGeneration(4))
	require.True(t, teamName.Eq(team.Name))
}

// Test loading a sub-sub-team: a.b.c.
func TestFastLoaderMultilevel(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create a team")
	parentName, _ := createTeam2(*tcs[0])

	t.Logf("create a subteam (of parent %s)", parentName)
	m := make([]libkb.MetaContext, 2)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}
	_, err := CreateSubteam(m[0].Ctx(), tcs[0].G, "abc", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	subTeamName, err := parentName.Append("abc")
	require.NoError(t, err)
	t.Logf("create a sub-subteam (of parent %s)", subTeamName)
	subsubteamID, err := CreateSubteam(m[0].Ctx(), tcs[0].G, "def", subTeamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	expectedSubsubTeamName, err := subTeamName.Append("def")
	require.NoError(t, err)
	t.Logf("subsubteam is: %s (%s)", expectedSubsubTeamName.String(), *subsubteamID)

	t.Logf("add the other user to the subsubteam")
	_, err = AddMember(m[0].Ctx(), tcs[0].G, expectedSubsubTeamName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("load the subteam")
	arg := keybase1.FastTeamLoadArg{
		ID:            *subsubteamID,
		Applications:  []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		NeedLatestKey: true,
	}
	team, err := tcs[1].G.GetFastTeamLoader().Load(m[1], arg)
	require.NoError(t, err)
	require.Equal(t, len(team.ApplicationKeys), 1)
	require.Equal(t, team.ApplicationKeys[0].KeyGeneration, keybase1.PerTeamKeyGeneration(1))
	require.True(t, expectedSubsubTeamName.Eq(team.Name))
}

func TestFastLoaderUpPointerUnstub(t *testing.T) {

	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	// Require that a team is at this key generation
	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])
	t.Logf("add B to the team so they can load it")
	m := make([]libkb.MetaContext, 2)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}
	_, err := AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER)
	require.NoError(t, err)
	subteamID, err := CreateSubteam(m[0].Ctx(), tcs[0].G, "abc", teamName, keybase1.TeamRole_WRITER /* addSelfAs */)
	require.NoError(t, err)

	expectedSubTeamName, err := teamName.Append("abc")
	require.NoError(t, err)
	t.Logf("subsubteam is: %s (%s)", expectedSubTeamName.String(), *subteamID)

	t.Logf("rotate the key a bunch of times")
	// Rotate the key by removing and adding B from the team
	for i := 0; i < 3; i++ {
		err = RemoveMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username)
		require.NoError(t, err)
		_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER)
		require.NoError(t, err)
	}
	t.Logf("load the team")
	arg := keybase1.FastTeamLoadArg{
		ID:            teamID,
		Applications:  []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		NeedLatestKey: true,
	}
	_, err = tcs[0].G.GetFastTeamLoader().Load(m[0], arg)
	require.NoError(t, err)

	loadSubteam := func() {
		t.Logf("load the subteam")
		arg = keybase1.FastTeamLoadArg{
			ID:            *subteamID,
			Applications:  []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
			NeedLatestKey: true,
		}
		team, err := tcs[0].G.GetFastTeamLoader().Load(m[0], arg)
		require.NoError(t, err)
		require.True(t, expectedSubTeamName.Eq(team.Name))
	}

	// Try again via the unstub system
	loadSubteam()

	// Also check that it works on a fresh load on a clean cache (thought this
	// duplicates what we did in TestFastLoaderMultilevel)
	tcs[0].G.GetFastTeamLoader().OnLogout()
	loadSubteam()

}
