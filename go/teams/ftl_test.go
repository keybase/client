package teams

import (
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
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
	fus, tcs, cleanup := setupNTests(t, 4)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])
	m := make([]libkb.MetaContext, 4)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)
	t.Logf("add C to the team so they can load it")
	_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[2].Username, keybase1.TeamRole_BOT, nil)
	require.NoError(t, err)
	t.Logf("add D to the team so they can load it")
	_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[3].Username, keybase1.TeamRole_RESTRICTEDBOT, &keybase1.TeamBotSettings{})
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

	t.Logf("C's first load at gen 1")
	arg = keybase1.FastTeamLoadArg{
		ID:            teamID,
		Applications:  []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		NeedLatestKey: true,
	}
	team, err = tcs[2].G.GetFastTeamLoader().Load(m[2], arg)
	require.NoError(t, err)
	require.Equal(t, len(team.ApplicationKeys), 1)
	require.Equal(t, team.ApplicationKeys[0].KeyGeneration, keybase1.PerTeamKeyGeneration(1))
	require.True(t, teamName.Eq(team.Name))

	t.Logf("D's first load at gen 1")
	arg = keybase1.FastTeamLoadArg{
		ID: teamID,
	}
	// since D is a restricted bot, they should not have access to any keys, so the fast loader can fail here.
	team, err = tcs[3].G.GetFastTeamLoader().Load(m[3], arg)
	require.Error(t, err)
	require.IsType(t, libkb.HiddenChainDataMissingError{}, err)
	require.Zero(t, len(team.ApplicationKeys))
	arg = keybase1.FastTeamLoadArg{
		ID:            teamID,
		Applications:  []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		NeedLatestKey: true,
	}
	require.Error(t, err)
	require.IsType(t, libkb.HiddenChainDataMissingError{}, err)
	require.Zero(t, len(team.ApplicationKeys))

	t.Logf("rotate the key a bunch of times")
	// Rotate the key by removing and adding B from the team
	for i := 0; i < 3; i++ {
		err = RemoveMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username)
		require.NoError(t, err)

		_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER, nil)
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
	require.NoError(t, err)
	require.Equal(t, len(team.ApplicationKeys), 1)
	require.Equal(t, team.ApplicationKeys[0].KeyGeneration, keybase1.PerTeamKeyGeneration(4))
	require.True(t, teamName.Eq(team.Name))

	t.Logf("B loads the new PTK by latest")
	arg.NeedLatestKey = true
	arg.KeyGenerationsNeeded = []keybase1.PerTeamKeyGeneration{}
	team, err = tcs[1].G.GetFastTeamLoader().Load(m[1], arg)
	require.NoError(t, err)
	require.Equal(t, len(team.ApplicationKeys), 1)
	require.Equal(t, team.ApplicationKeys[0].KeyGeneration, keybase1.PerTeamKeyGeneration(4))
	require.True(t, teamName.Eq(team.Name))

	t.Logf("clear A's FTL state")
	ftl, ok := tcs[0].G.GetFastTeamLoader().(*FastTeamChainLoader)
	require.True(t, ok)
	require.NoError(t, ftl.OnLogout(m[0]))

	t.Logf("more tests as A; let's first load at generation=1")
	arg = keybase1.FastTeamLoadArg{
		ID:                   teamID,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(1)},
	}
	team, err = tcs[0].G.GetFastTeamLoader().Load(m[0], arg)
	require.NoError(t, err)
	require.Equal(t, len(team.ApplicationKeys), 1)
	require.Equal(t, team.ApplicationKeys[0].KeyGeneration, keybase1.PerTeamKeyGeneration(1))
	require.True(t, teamName.Eq(team.Name))

	t.Logf("let's now load at the latest generation")
	arg = keybase1.FastTeamLoadArg{
		ID:            teamID,
		Applications:  []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		NeedLatestKey: true,
	}
	team, err = tcs[0].G.GetFastTeamLoader().Load(m[0], arg)
	require.NoError(t, err)
	require.Equal(t, len(team.ApplicationKeys), 1)
	require.Equal(t, team.ApplicationKeys[0].KeyGeneration, keybase1.PerTeamKeyGeneration(4))
	require.True(t, teamName.Eq(team.Name))

	t.Logf("make sure D still doesn't have access")
	arg = keybase1.FastTeamLoadArg{
		ID: teamID,
	}
	team, err = tcs[3].G.GetFastTeamLoader().Load(m[3], arg)
	require.Error(t, err)
	require.IsType(t, libkb.HiddenChainDataMissingError{}, err)
	require.Zero(t, len(team.ApplicationKeys))

	arg = keybase1.FastTeamLoadArg{
		ID:                   teamID,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(1)},
	}
	team, err = tcs[3].G.GetFastTeamLoader().Load(m[3], arg)
	require.Error(t, err)
	require.IsType(t, libkb.HiddenChainDataMissingError{}, err)
	require.Zero(t, len(team.ApplicationKeys))

	t.Logf("upgrade D to a bot and check they have access")
	err = RemoveMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[3].Username)
	require.NoError(t, err)
	_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[3].Username, keybase1.TeamRole_BOT, nil)
	require.NoError(t, err)

	arg.NeedLatestKey = false
	arg.KeyGenerationsNeeded = []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(4)}
	team, err = tcs[3].G.GetFastTeamLoader().Load(m[3], arg)
	require.NoError(t, err)
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
	_, err = AddMember(m[0].Ctx(), tcs[0].G, expectedSubsubTeamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
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
	_, err := AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER, nil)
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
		_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER, nil)
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
	ftl, ok := tcs[0].G.GetFastTeamLoader().(*FastTeamChainLoader)
	require.True(t, ok)
	require.NoError(t, ftl.OnLogout(m[0]))
	loadSubteam()
}

// See CORE-8859, there was a bug that showed up when we loaded the subteam first and then
// the parent, since when we loaded the subteam, we were in "subteam reader" mode, and
// due to a previous server bug, didn't get boxes and prevs back when in subteam reader mode.
// Then, when we tried to access a box in the parent, we would fail. Test that it works.
func TestLoadSubteamThenParent(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])
	t.Logf("add B to the team so they can load it")
	m := make([]libkb.MetaContext, 2)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}
	_, err := AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)
	subteamID, err := CreateSubteam(m[0].Ctx(), tcs[0].G, "abc", teamName, keybase1.TeamRole_WRITER /* addSelfAs */)
	require.NoError(t, err)

	expectedSubTeamName, err := teamName.Append("abc")
	require.NoError(t, err)
	t.Logf("subsubteam is: %s (%s)", expectedSubTeamName.String(), *subteamID)

	t.Logf("rotate the parent team a bunch of times")
	// Rotate the key by removing and adding B from the team
	for i := 0; i < 3; i++ {
		err = RemoveMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username)
		require.NoError(t, err)
		_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER, nil)
		require.NoError(t, err)
	}

	loadSubteam := func() {
		t.Logf("load the subteam")
		arg := keybase1.FastTeamLoadArg{
			ID:            *subteamID,
			Applications:  []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
			NeedLatestKey: true,
		}
		team, err := tcs[0].G.GetFastTeamLoader().Load(m[0], arg)
		require.NoError(t, err)
		require.True(t, expectedSubTeamName.Eq(team.Name))
	}

	loadTeam := func(g keybase1.PerTeamKeyGeneration) {
		t.Logf("load the team")
		arg := keybase1.FastTeamLoadArg{
			ID:                   teamID,
			Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
			KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{g},
		}
		_, err := tcs[0].G.GetFastTeamLoader().Load(m[0], arg)
		require.NoError(t, err)
	}

	loadSubteam()
	loadTeam(3)
}

// See CORE-9207, there was a bug with this order of operations: (1) loading foo.bar;
// (2) being let into foo; (3) loading foo.
func TestLoadSubteamThenAllowedInThenParent(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])
	t.Logf("add B to the team so they can load it")
	m := make([]libkb.MetaContext, 3)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}

	rotateKey := func(name keybase1.TeamName) {
		_, err := AddMember(m[0].Ctx(), tcs[0].G, name.String(), fus[1].Username, keybase1.TeamRole_READER, nil)
		require.NoError(t, err)
		err = RemoveMember(m[0].Ctx(), tcs[0].G, name.String(), fus[1].Username)
		require.NoError(t, err)
	}

	for i := 0; i < 3; i++ {
		rotateKey(teamName)
	}

	subteamID, err := CreateSubteam(m[0].Ctx(), tcs[0].G, "abc", teamName, keybase1.TeamRole_ADMIN /* addSelfAs */)
	require.NoError(t, err)
	expectedSubTeamName, err := teamName.Append("abc")
	require.NoError(t, err)
	_, err = AddMember(m[0].Ctx(), tcs[0].G, expectedSubTeamName.String(), fus[2].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	loadTeam := func(teamID keybase1.TeamID, g keybase1.PerTeamKeyGeneration) {
		t.Logf("load the team")
		arg := keybase1.FastTeamLoadArg{
			ID:                   teamID,
			Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
			KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{g},
		}
		_, err := tcs[2].G.GetFastTeamLoader().Load(m[2], arg)
		require.NoError(t, err)
	}

	loadTeam(*subteamID, 1)
	_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[2].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	loadTeam(teamID, 1)
}

// See CORE-8894 for what happened here. The flow is: (1) user loads parent team at generation=N;
// (2) there's a key rotation; (3) loads child team and gets the new box and prevs for generation=N+1,
// but no RKMs; (4) loads the RKMs for the most recent generation. Test a fix for this case.
func TestLoadRKMForLatestCORE8894(t *testing.T) {
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
	_, err := AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)
	subteamID, err := CreateSubteam(m[0].Ctx(), tcs[0].G, "abc", teamName, keybase1.TeamRole_WRITER /* addSelfAs */)
	require.NoError(t, err)

	expectedSubTeamName, err := teamName.Append("abc")
	require.NoError(t, err)
	t.Logf("subsubteam is: %s (%s)", expectedSubTeamName.String(), *subteamID)

	loadTeam := func(id keybase1.TeamID, forceRefresh bool) {
		t.Logf("load the team %s", id)
		arg := keybase1.FastTeamLoadArg{
			ID:            id,
			Applications:  []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
			ForceRefresh:  forceRefresh,
			NeedLatestKey: true,
		}
		_, err := tcs[0].G.GetFastTeamLoader().Load(m[0], arg)
		require.NoError(t, err)
	}

	loadTeam(teamID, false)

	// Rotate the key by removing and adding B from the team
	for i := 0; i < 3; i++ {
		err = RemoveMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username)
		require.NoError(t, err)
		_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER, nil)
		require.NoError(t, err)
	}
	err = RotateKeyVisible(m[0].Ctx(), tcs[0].G, teamID)
	require.NoError(t, err)

	loadTeam(*subteamID, true)
	loadTeam(teamID, false)
}
