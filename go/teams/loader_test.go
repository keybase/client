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
// Returns (FakeUsers, TestContext, CleanupFunction)
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
