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
