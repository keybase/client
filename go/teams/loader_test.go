package teams

import (
	"sort"
	"testing"

	"golang.org/x/net/context"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestLoaderBasic(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	t.Logf("create a team")
	teamName, teamID := createTeam2(tc)

	t.Logf("load the team")
	team, err := tc.G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.Equal(t, teamID, team.Chain.Id)
	require.True(t, teamName.Eq(team.Name))

	t.Logf("load the team again")
	team, err = tc.G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.Equal(t, teamID, team.Chain.Id)
	require.True(t, teamName.Eq(team.Name))
}

// Test that the loader works after the cache turns stale
// and it goes to the server and finds that there are no updates.
// This does not actually verify that the loader tried to refresh.
func TestLoaderStaleNoUpdates(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	public := false

	t.Logf("create a team")
	teamName, teamID := createTeam2(tc)

	t.Logf("load the team")
	team, err := tc.G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:     teamID,
		Public: public,
	})
	require.NoError(t, err)
	require.Equal(t, teamID, team.Chain.Id)
	require.True(t, teamName.Eq(team.Name))

	t.Logf("make the cache look old")
	st := getStorageFromG(tc.G)
	team = st.Get(context.TODO(), teamID, public)
	require.NotNil(t, team)
	t.Logf("cache  pre-set cachedAt:%v", team.CachedAt.Time())
	team.CachedAt = keybase1.ToTime(tc.G.Clock().Now().Add(freshnessLimit * -2))
	st.Put(context.TODO(), team)
	t.Logf("cache post-set cachedAt:%v", team.CachedAt.Time())

	t.Logf("load the team again")
	team, err = tc.G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:     teamID,
		Public: public,
	})
	require.NoError(t, err)
	require.Equal(t, teamID, team.Chain.Id)
	require.True(t, teamName.Eq(team.Name))
	require.Equal(t, public, team.Chain.Public)
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
	team, err := tc.G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		Name: teamName.String(),
	})
	require.NoError(t, err)
	require.Equal(t, teamID, team.Chain.Id)
	require.True(t, teamName.Eq(team.Name))
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
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER)
	require.NoError(t, err)

	t.Logf("B's first load at gen 1")
	team, err := tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	requireGen(team, 1)
	require.Equal(t, keybase1.Seqno(2), team.Chain.LastSeqno, "chain seqno")
	require.Len(t, team.ReaderKeyMasks[keybase1.TeamApplication_KBFS], 1, "number of kbfs rkms")

	t.Logf("rotate the key a bunch of times")
	// Rotate the key by removing and adding B from the team
	for i := 0; i < 3; i++ {
		err = RemoveMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, false)
		require.NoError(t, err)

		_, err = AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER)
		require.NoError(t, err)
	}

	t.Logf("load as A to check the progression")
	team, err = tcs[0].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	requireGen(team, 4)
	require.Equal(t, keybase1.Seqno(8), team.Chain.LastSeqno)
	require.Len(t, team.ReaderKeyMasks[keybase1.TeamApplication_KBFS], 4, "number of kbfs rkms")

	t.Logf("B loads and hits its cache")
	team, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.Equal(t, keybase1.Seqno(2), team.Chain.LastSeqno, "chain seqno")
	requireGen(team, 1)
	require.Len(t, team.ReaderKeyMasks[keybase1.TeamApplication_KBFS], 1, "number of kbfs rkms")

	t.Logf("B loads with NeedKeyGeneration")
	team, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
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
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("U1 loads and caches")
	team, err := tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	requireSeqno(team, 2)

	t.Logf("U0 bumps the sigchain (add U3) (3)")
	_, err = AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[3].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("U1 loads and hits the cache")
	team, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	requireSeqno(team, 2)

	t.Logf("U1 loads with WantMembers=U2 and that causes a repoll but no error")
	loadAsU1WantU2 := func() *keybase1.TeamData {
		team, err := tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
			ID: teamID,
			Refreshers: keybase1.TeamRefreshers{
				WantMembers: []keybase1.UserVersion{fus[2].GetUserVersion()},
			},
		})
		require.NoError(t, err)
		return team
	}
	team = loadAsU1WantU2()
	requireSeqno(team, 3, "seqno should advance because wantmembers pre-check fails")

	t.Logf("U0 adds U2 (4)")
	_, err = AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[2].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U1 loads with WantMembers=U2 and it works")
	team = loadAsU1WantU2()
	requireSeqno(team, 4, "seqno should advance to pick up the new link")
	role, err := TeamSigChainState{inner: team.Chain}.GetUserRole(fus[2].GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_WRITER, role)

	t.Logf("U0 bumps the sigchain (removemember) (5)")
	err = RemoveMember(context.TODO(), tcs[0].G, teamName.String(), fus[3].Username, false)
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
	team, err := tcs[0].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	require.Equal(t, team.Chain.Id, teamID)
	require.False(t, TeamSigChainState{inner: team.Chain}.HasAnyStubbedLinks(), "team has stubbed links")
	subteamName, err := TeamSigChainState{inner: team.Chain}.GetSubteamName(*subteamID)
	if err != nil {
		t.Logf("seqno: %v", TeamSigChainState{team.Chain}.GetLatestSeqno())
		t.Logf("subteam log: %v", spew.Sdump(team.Chain.SubteamLog))
		require.NoError(t, err)
	}
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
	team, err := tcs[0].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: *subteamID,
	})
	require.NoError(t, err)
	require.Equal(t, team.Chain.Id, *subteamID)
	expectedSubteamName, err := parentName.Append("mysubteam")
	require.NoError(t, err)
	require.Equal(t, expectedSubteamName, team.Name)
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
	_, err = AddMember(context.TODO(), tcs[0].G, parentName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U1 loads the parent")
	_, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: parentID,
	})
	require.NoError(t, err)

	t.Logf("add U1 to the subteam")
	subteamName, err := parentName.Append("mysubteam")
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tcs[0].G, subteamName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U1 loads the subteam")
	_, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: *subteamID,
	})
	require.NoError(t, err)
}

// Test loading a team and when not a member of the parent.
// User loads a team T1.T2 but has never been a member of T1.
func TestLoaderNotInParent(t *testing.T) {
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
	_, err = AddMember(context.TODO(), tcs[0].G, subteamName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U1 loads the subteam")
	_, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: *subteamID,
	})
	require.NoError(t, err)
}

// Test loading a sub-sub-team: a.b.c.
// When not a member of the ancestors: a, a.b.
func TestLoaderMultilevel(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create a team")
	parentName, _ := createTeam2(*tcs[0])

	t.Logf("create a subteam")
	_, err := CreateSubteam(context.TODO(), tcs[0].G, "abc", parentName)
	require.NoError(t, err)

	t.Logf("create a sub-subteam")
	subTeamName, err := parentName.Append("abc")
	require.NoError(t, err)
	subsubteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "def", subTeamName)
	require.NoError(t, err)

	expectedSubsubTeamName, err := subTeamName.Append("def")
	require.NoError(t, err)

	t.Logf("add the other user to the subsubteam")
	_, err = AddMember(context.TODO(), tcs[0].G, expectedSubsubTeamName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("load the subteam")
	team, err := tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: *subsubteamID,
	})
	require.NoError(t, err)
	require.Equal(t, *subsubteamID, team.Chain.Id)
	require.Equal(t, expectedSubsubTeamName, team.Name)
}

// Test that loading with wantmembers which have eldestseqno=0 works.
func TestLoaderInferWantMembers(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	// Require that a team is at this seqno
	requireSeqno := func(team *keybase1.TeamData, seqno int, dots ...interface{}) {
		require.NotNil(t, team, dots...)
		require.Equal(t, keybase1.Seqno(seqno), TeamSigChainState{inner: team.Chain}.GetLatestSeqno(), dots...)
	}

	t.Logf("U0 creates a team (seqno:1)")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 to the team (2)")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("U1 loads and caches")
	team, err := tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	requireSeqno(team, 2)

	t.Logf("U0 bumps the sigchain (add U2) (3)")
	_, err = AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[2].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("U1 loads and hits the cache")
	team, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	requireSeqno(team, 2)

	t.Logf("U1 loads with WantMembers=U2 which infers the eldestseqno and repolls")
	loadAsU1WantU2 := func() *keybase1.TeamData {
		team, err := tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
			ID: teamID,
			Refreshers: keybase1.TeamRefreshers{
				WantMembers: []keybase1.UserVersion{keybase1.UserVersion{
					Uid:         fus[2].GetUID(),
					EldestSeqno: 0,
				}},
			},
		})
		require.NoError(t, err)
		return team
	}
	team = loadAsU1WantU2()
	requireSeqno(team, 3, "seqno should advance because wantmembers pre-check fails")
}

func TestLoaderGetImplicitAdminsList(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	t.Logf("U1 creates a root team")
	parentName, _ := createTeam2(*tcs[1])

	t.Logf("U1 adds U2 as an admin")
	_, err := AddMember(context.TODO(), tcs[1].G, parentName.String(), fus[2].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("U2 creates a subteam")
	subteamID, err := CreateSubteam(context.TODO(), tcs[2].G, "sub", parentName)
	require.NoError(t, err)
	subteamName, err := parentName.Append("sub")
	require.NoError(t, err)

	t.Logf("U0 can't load the subteam")
	_, err = tcs[0].G.GetTeamLoader().ImplicitAdmins(context.TODO(), *subteamID)
	require.Error(t, err, "should not be able to load team when not a member")

	t.Logf("U2 adds U0 to the subteam (as an admin)")
	_, err = AddMember(context.TODO(), tcs[2].G, subteamName.String(), fus[0].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err, "adding member to subteam")

	assertImpAdmins := func(as *libkb.GlobalContext, teamID keybase1.TeamID, expectedSet []keybase1.UserVersion) {
		impAdmins, err := as.GetTeamLoader().ImplicitAdmins(context.TODO(), teamID)
		require.NoError(t, err)
		require.Len(t, impAdmins, len(expectedSet), "number of implicit admins")
		sort.SliceStable(impAdmins, func(i, j int) bool {
			return impAdmins[i].String() < impAdmins[j].String()
		})
		sort.SliceStable(expectedSet, func(i, j int) bool {
			return expectedSet[i].String() < expectedSet[j].String()
		})
		require.Equal(t, expectedSet, impAdmins, "assertImpAdmins")
	}

	t.Logf("U0 sees the 2 implicit admins")
	assertImpAdmins(tcs[0].G, *subteamID, []keybase1.UserVersion{fus[1].GetUserVersion(), fus[2].GetUserVersion()})

	t.Logf("U1 adds U0 to the root team")
	_, err = AddMember(context.TODO(), tcs[1].G, parentName.String(), fus[0].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("U0 sees the 3 implicit admins")
	assertImpAdmins(tcs[0].G, *subteamID, []keybase1.UserVersion{fus[0].GetUserVersion(), fus[1].GetUserVersion(), fus[2].GetUserVersion()})
}

// Subteams should be invisible to writers.
// U0 creates a subteam
// U0 adds U1 to the root team
// U1 should not see any subteams
func TestLoaderHiddenSubteam(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates A")
	parentName, parentID := createTeam2(*tcs[0])

	subteamName1 := createTeamName(t, parentName.String(), "bbb")

	t.Logf("U0 creates A.B")
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "bbb", parentName)
	require.NoError(t, err)

	t.Logf("U0 adds U1 to A as a WRITER")
	_, err = AddMember(context.TODO(), tcs[0].G, parentName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U0 loads A")
	team, err := Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID:          parentID,
		ForceRepoll: true,
	})
	require.NoError(t, err, "load team")
	t.Logf(spew.Sdump(team.chain().inner.SubteamLog))
	require.Len(t, team.chain().ListSubteams(), 1, "subteam list")
	require.Equal(t, *subteamID, team.chain().ListSubteams()[0].Id, "subteam ID")
	require.Equal(t, subteamName1.String(), team.chain().ListSubteams()[0].Name.String(), "subteam name")

	t.Logf("U1 loads A")
	team, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          parentID,
		ForceRepoll: true,
	})
	require.NoError(t, err, "load team")
	t.Logf(spew.Sdump(team.chain().inner.SubteamLog))
	require.Len(t, team.chain().inner.SubteamLog, 0, "subteam log should be empty because all subteam links were stubbed for this user")
}

func TestLoaderSubteamHopWithNone(t *testing.T) {
	testLoaderSubteamHop(t, keybase1.TeamRole_NONE)
}

// A member of A and A.B.C but not A.B should be able to load A.B.C
// when they have already cached A with the new_subteam stubbed out.
func TestLoaderSubteamHopWithWriter(t *testing.T) {
	testLoaderSubteamHop(t, keybase1.TeamRole_WRITER)
}

func TestLoaderSubteamHopWithAdmin(t *testing.T) {
	testLoaderSubteamHop(t, keybase1.TeamRole_ADMIN)
}

func testLoaderSubteamHop(t *testing.T, roleInRoot keybase1.TeamRole) {
	t.Logf("testing with roleInRoot: %v", roleInRoot)
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates A")
	rootName, rootID := createTeam2(*tcs[0])

	t.Logf("U0 creates A.B")
	subteamName, subteamID := createSubteam(tcs[0], rootName, "bbb")

	if roleInRoot != keybase1.TeamRole_NONE {
		t.Logf("U0 adds U1 to A")
		_, err := AddMember(context.TODO(), tcs[0].G, rootName.String(), fus[1].Username, roleInRoot)
		require.NoError(t, err, "add member")

		t.Logf("U1 loads and caches A (with A.B's new_subteam link stubbed out)")
		_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
			ID:          rootID,
			ForceRepoll: true,
		})
		require.NoError(t, err, "load team")
	}

	t.Logf("U0 creates A.B.C")
	subsubteamName, subsubteamID := createSubteam(tcs[0], subteamName, "ccc")

	t.Logf("U0 adds U1 to A.B.C")
	_, err := AddMember(context.TODO(), tcs[0].G, subsubteamName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err, "add member")

	t.Logf("U1 loads A.B.C")
	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          subsubteamID,
		ForceRepoll: true,
	})
	require.NoError(t, err, "load team")

	if roleInRoot == keybase1.TeamRole_NONE {
		t.Logf("U1 cannot load A.B")
		_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
			ID: subteamID,
		})
		require.Error(t, err, "shouldn't load team")
	}
}

func TestLoaderCORE_6230(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates A")
	rootName, rootID := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 to A")
	_, err := AddMember(context.TODO(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err, "add member")

	t.Logf("U1 loads and caches A")
	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          rootID,
		ForceRepoll: true,
	})
	require.NoError(t, err, "load team")

	t.Logf("U0 creates A.B")
	subteamName, subteamID := createSubteam(tcs[0], rootName, "bbb")

	t.Logf("U0 adds U1 to A.B")
	_, err = AddMember(context.TODO(), tcs[0].G, subteamName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err, "add member")

	t.Logf("U1 loads A.B")
	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          subteamID,
		ForceRepoll: true,
	})
	// There was a bug where this would fail with:
	//   proof error for proof 'became admin before team link': no linkID for seqno 3
	require.NoError(t, err, "load team")
}

func TestLoaderCORE_6230_2(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates A")
	rootName, rootID := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 to A")
	_, err := AddMember(context.TODO(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err, "add member")

	t.Logf("U1 loads and caches A")
	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          rootID,
		ForceRepoll: true,
	})
	require.NoError(t, err, "load team")

	t.Logf("U0 creates A.B")
	subteamName, subteamID := createSubteam(tcs[0], rootName, "bbb")

	t.Logf("U0 adds U1 to A.B")
	_, err = AddMember(context.TODO(), tcs[0].G, subteamName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err, "add member")

	t.Logf("U1 loads A.B")
	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          subteamID,
		ForceRepoll: true,
	})
	_ = err // ignore the error if there is one, not testing that part.

	t.Logf("U1 loads A.B (again, in case there was a bug above)")
	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          subteamID,
		ForceRepoll: true,
	})
	require.NoError(t, err, "load team")

	t.Logf("U0 adds a link to A")
	_, err = AddMember(context.TODO(), tcs[0].G, rootName.String(), "foobar@rooter", keybase1.TeamRole_READER)

	t.Logf("U0 does an admin action to A.B")
	_, err = AddMember(context.TODO(), tcs[0].G, subteamName.String(), fus[0].Username, keybase1.TeamRole_READER)

	t.Logf("U1 loads A.B")
	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          subteamID,
		ForceRepoll: true,
	})
	require.NoError(t, err, "load team")
}
