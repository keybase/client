package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// Create n TestContexts with logged in users
// Returns (FakeUsers, TestContexts, CleanupFunction)
func setupNTests(t *testing.T, n int) ([]*kbtest.FakeUser, []*libkb.TestContext, func()) {
	require.True(t, n > 0, "must create at least 1 tc")
	var fus []*kbtest.FakeUser
	var tcs []*libkb.TestContext
	for i := 0; i < n; i++ {
		tc := SetupTest(t, "team", 1)
		tcs = append(tcs, &tc)
		fu, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
		require.NoError(t, err)
		fus = append(fus, fu)
	}
	cleanup := func() {
		for _, tc := range tcs {
			tc.Cleanup()
		}
	}
	return fus, tcs, cleanup
}

func TestLoaderDoesntCrash(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	require.NotNil(t, tc.G.GetTeamLoader(), "team loader on G")
	_, err = tc.G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: "abcdef",
	})
	require.Error(t, err, "load not implemented")
	require.Equal(t, "TODO: implement team loader", err.Error())
}

func TestLoaderBasic(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	t.Logf("create a team")
	teamName, teamID := createTeam2(tc)

	t.Logf("load the team")
	team, err := tc.G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.Equal(t, teamID, team.Chain.Id)
	require.True(t, teamName.Eq(team.Chain.Name))

	t.Logf("load the team again")
	team, err = tc.G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.Equal(t, teamID, team.Chain.Id)
	require.True(t, teamName.Eq(team.Chain.Name))
}

// Test that the loader works after the cache turns stale
// and it goes to the server and finds that there are no updates.
// This does not actually verify that the loader tried to refresh.
func TestLoaderStaleNoUpdates(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	t.Logf("create a team")
	teamName, teamID := createTeam2(tc)

	t.Logf("load the team")
	team, err := tc.G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.Equal(t, teamID, team.Chain.Id)
	require.True(t, teamName.Eq(team.Chain.Name))

	t.Logf("make the cache look old")
	st := getStorageFromG(tc.G)
	team = st.Get(context.TODO(), teamID)
	require.NotNil(t, team)
	t.Logf("cache  pre-set cachedAt:%v", team.CachedAt.Time())
	team.CachedAt = keybase1.ToTime(tc.G.Clock().Now().Add(freshnessLimit * -2))
	st.Put(context.TODO(), team)
	t.Logf("cache post-set cachedAt:%v", team.CachedAt.Time())

	t.Logf("load the team again")
	team, err = tc.G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.Equal(t, teamID, team.Chain.Id)
	require.True(t, teamName.Eq(team.Chain.Name))
}

// Test loading a root team by name.
func TestLoaderByName(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	t.Logf("create a team")
	teamName, teamID := createTeam2(tc)

	t.Logf("load the team")
	team, err := tc.G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		Name: teamName.String(),
	})
	require.NoError(t, err)
	require.Equal(t, teamID, team.Chain.Id)
	require.True(t, teamName.Eq(team.Chain.Name))
}

// Test loading a team with NeedKeyGeneration set.
// User A creates a team and rotate the key several times.
// User B caches the team at generation 1, and then loads with NeedKeyGeneration later.
//   which should get the latest generation that exists.
func TestLoaderKeyGen(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	// Require that a team is at this key generation
	requireGen := func(team *keybase1.TeamData, generation int) {
		require.NotNil(t, team)
		require.Len(t, team.PerTeamKeySeeds, generation)
		require.Len(t, team.Chain.PerTeamKeys, generation)
	}

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])
	t.Logf("add B to the team so they can load it")
	err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER)
	require.NoError(t, err)

	t.Logf("B's first load at gen 1")
	team, err := tcs[1].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	requireGen(team, 1)
	require.Equal(t, keybase1.Seqno(2), team.Chain.LastSeqno, "chain seqno")
	require.Len(t, team.ReaderKeyMasks[keybase1.TeamApplication_KBFS], 1, "number of kbfs rkms")

	t.Logf("rotate the key a bunch of times")
	// Rotate the key by removing and adding B from the team
	for i := 0; i < 3; i++ {
		err = RemoveMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username)
		require.NoError(t, err)

		err = AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER)
		require.NoError(t, err)
	}

	t.Logf("load as A to check the progression")
	team, err = tcs[0].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	requireGen(team, 4)
	require.Equal(t, keybase1.Seqno(8), team.Chain.LastSeqno)
	require.Len(t, team.ReaderKeyMasks[keybase1.TeamApplication_KBFS], 4, "number of kbfs rkms")

	t.Logf("B loads and hits its cache")
	team, err = tcs[1].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.Equal(t, keybase1.Seqno(2), team.Chain.LastSeqno, "chain seqno")
	requireGen(team, 1)
	require.Len(t, team.ReaderKeyMasks[keybase1.TeamApplication_KBFS], 1, "number of kbfs rkms")

	t.Logf("B loads with NeedKeyGeneration")
	team, err = tcs[1].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
		Refreshers: keybase1.TeamRefreshers{
			NeedKeyGeneration: 3,
		},
	})
	require.NoError(t, err)
	requireGen(team, 4)
	require.Len(t, team.ReaderKeyMasks[keybase1.TeamApplication_KBFS], 4, "number of kbfs rkms")
}

// Test loading a team with WantMembers set.
func TestLoaderWantMembers(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 4)
	defer cleanup()

	// Require that a team is at this seqno
	requireSeqno := func(team *keybase1.TeamData, seqno int, dots ...interface{}) {
		require.NotNil(t, team, dots...)
		require.Equal(t, keybase1.Seqno(seqno), TeamSigChainState{inner: team.Chain}.GetLatestSeqno(), dots...)
	}

	t.Logf("U0 creates a team (seqno:1)")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 to the team (2)")
	err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("U1 loads and caches")
	team, err := tcs[1].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	requireSeqno(team, 2)

	t.Logf("U0 bumps the sigchain (add U3) (3)")
	err = AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[3].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("U1 loads and hits the cache")
	team, err = tcs[1].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	requireSeqno(team, 2)

	t.Logf("U1 loads with WantMembers=U2 and that causes a repoll but no error")
	loadAsU1WantU2 := func() *keybase1.TeamData {
		team, err := tcs[1].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
			ID: teamID,
			Refreshers: keybase1.TeamRefreshers{
				WantMembers: []keybase1.UserVersion{{
					Uid:         fus[2].GetUID(),
					EldestSeqno: keybase1.Seqno(1),
				}},
			},
		})
		require.NoError(t, err)
		return team
	}
	team = loadAsU1WantU2()
	requireSeqno(team, 3, "seqno should advance because wantmembers pre-check fails")

	t.Logf("U0 adds U2 (4)")
	err = AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[2].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U1 loads with WantMembers=U2 and it works")
	team = loadAsU1WantU2()
	requireSeqno(team, 4, "seqno should advance to pick up the new link")
	role, err := TeamSigChainState{inner: team.Chain}.GetUserRole(keybase1.UserVersion{
		Uid:         fus[2].GetUID(),
		EldestSeqno: keybase1.Seqno(1),
	})
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_WRITER, role)

	t.Logf("U0 bumps the sigchain (removemember) (5)")
	err = RemoveMember(context.TODO(), tcs[0].G, teamName.String(), fus[3].Username)
	require.NoError(t, err)

	t.Logf("U1 loads with WantMembers=U2 and it hits the cache")
	team = loadAsU1WantU2()
	requireSeqno(team, 4, "seqno should not advance because this should be a cache hit")
}

// Test loading a team that has a subteam in it
func TestLoaderParentEasy(t *testing.T) {
	_, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	t.Logf("create a team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("create a subteam")
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "mysubteam", teamName)
	require.NoError(t, err)

	t.Logf("load the parent")
	team, err := tcs[0].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.Equal(t, team.Chain.Id, teamID)
	subteamName, err := TeamSigChainState{inner: team.Chain}.GetSubteamName(*subteamID)
	require.NoError(t, err)
	expectedSubteamName, err := teamName.Append("mysubteam")
	require.NoError(t, err)
	require.Equal(t, expectedSubteamName, *subteamName)
}

// Test loading a subteam
func TestLoaderSubteamEasy(t *testing.T) {
	_, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	t.Logf("create a team")
	parentName, parentID := createTeam2(*tcs[0])

	t.Logf("create a subteam")
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "mysubteam", parentName)
	require.NoError(t, err)

	t.Logf("load the subteam")
	team, err := tcs[0].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: *subteamID,
	})
	require.NoError(t, err)
	require.Equal(t, team.Chain.Id, *subteamID)
	expectedSubteamName, err := parentName.Append("mysubteam")
	require.NoError(t, err)
	require.Equal(t, expectedSubteamName, TeamSigChainState{inner: team.Chain}.GetName())
	require.Equal(t, parentID, *team.Chain.ParentID)
}

// Test loading a team and filling in links.
// User loads a team T1 with subteam links stubbed out,
// then gets added to T1.T2 and T1,
// then loads T1.T2, which causes T1 to have to fill in the subteam links.
func TestLoaderFillStubbed(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create a team")
	parentName, parentID := createTeam2(*tcs[0])

	t.Logf("create a subteam")
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "mysubteam", parentName)
	require.NoError(t, err)

	t.Logf("add U1 to the parent")
	err = AddMember(context.TODO(), tcs[0].G, parentName.String(), fus[1].Username, keybase1.TeamRole_WRITER)

	t.Logf("U1 loads the parent")
	_, err = tcs[1].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: parentID,
	})
	require.NoError(t, err)

	t.Logf("add U1 to the subteam")
	subteamName, err := parentName.Append("mysubteam")
	require.NoError(t, err)
	err = AddMember(context.TODO(), tcs[0].G, subteamName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U1 loads the subteam")
	_, err = tcs[1].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: *subteamID,
	})
	require.NoError(t, err)
}

// Test loading a team and when not a member of the parent.
// User loads a team T1.T2 but has never been a member of T1.
func TestLoaderNotInParent(t *testing.T) {
	t.Skip("TODO: awaiting non-member parent read")

	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create a team")
	parentName, _ := createTeam2(*tcs[0])

	t.Logf("create a subteam")
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "mysubteam", parentName)
	require.NoError(t, err)

	t.Logf("add U1 to the subteam")
	subteamName, err := parentName.Append("mysubteam")
	require.NoError(t, err)
	err = AddMember(context.TODO(), tcs[0].G, subteamName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U1 loads the subteam")
	_, err = tcs[1].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: *subteamID,
	})
	require.NoError(t, err)
}

// Test loading a sub-sub-team.
// When not a member of the ancestors.
func TestLoaderMultilevel(t *testing.T) {
	t.Skip("TODO: awaiting non-member parent read")

	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create a team")
	parentName, _ := createTeam2(*tcs[0])

	t.Logf("create a subteam")
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "abc", parentName)
	require.NoError(t, err)

	t.Logf("create a sub-subteam")
	subsubteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "def", parentName)
	require.NoError(t, err)

	expectedSubsubTeamName, err := parentName.Append("abc")
	require.NoError(t, err)
	expectedSubsubTeamName, err = parentName.Append("def")
	require.NoError(t, err)

	t.Logf("add the other user to the subsubteam")
	err = AddMember(context.TODO(), tcs[0].G, expectedSubsubTeamName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("load the subteam")
	team, err := tcs[1].G.GetTeamLoader().(*TeamLoader).LoadTODO(context.TODO(), keybase1.LoadTeamArg{
		ID: *subsubteamID,
	})
	require.NoError(t, err)
	require.Equal(t, team.Chain.Id, *subteamID)
	require.Equal(t, expectedSubsubTeamName, TeamSigChainState{inner: team.Chain}.GetName())
	require.Equal(t, subteamID, *team.Chain.ParentID)
}
