package teams

import (
	"bytes"
	"encoding/hex"
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
	mctx := libkb.NewMetaContextForTest(tc)
	team, frozen, tombstoned := st.Get(mctx, teamID, public)
	require.False(t, frozen)
	require.False(t, tombstoned)
	require.NotNil(t, team)
	t.Logf("cache  pre-set cachedAt:%v", team.CachedAt.Time())
	team.CachedAt = keybase1.ToTime(tc.G.Clock().Now().Add(freshnessLimit * -2))
	st.Put(mctx, team)
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
		require.Len(t, team.PerTeamKeySeedsUnverified, generation)
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
		err = RemoveMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username)
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

func TestLoaderKBFSKeyGen(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	// Require that a team is at this KBFS key generation
	requireGen := func(team *keybase1.TeamData, generation int) {
		require.NotNil(t, team)
		keys, ok := team.TlfCryptKeys[keybase1.TeamApplication_CHAT]
		require.True(t, ok)
		require.True(t, keys[len(keys)-1].KeyGeneration >= generation)
	}

	displayName := fus[0].Username + "," + fus[1].Username
	team, _, _, err := LookupOrCreateImplicitTeam(context.TODO(), tcs[0].G, displayName, false)
	require.NoError(t, err)

	tlfID := newImplicitTLFID(false)
	cryptKeys := []keybase1.CryptKey{keybase1.CryptKey{
		KeyGeneration: 1,
	}, keybase1.CryptKey{
		KeyGeneration: 2,
	}}
	require.NoError(t, team.AssociateWithTLFKeyset(context.TODO(), tlfID, cryptKeys,
		keybase1.TeamApplication_CHAT))
	team, err = Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID: team.ID,
	})
	require.NoError(t, err)

	// See TODO below, CORE-9677. This test previously relied on buggy behavior, which now is fixed.
	//require.Zero(t, len(team.KBFSCryptKeys(context.TODO(), keybase1.TeamApplication_CHAT)))

	team, err = Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID: team.ID,
		Refreshers: keybase1.TeamRefreshers{
			NeedKBFSKeyGeneration: keybase1.TeamKBFSKeyRefresher{
				Generation: 2,
				AppType:    keybase1.TeamApplication_CHAT,
			},
		},
	})
	require.NoError(t, err)
	requireGen(team.Data, 2)
}

func TestLoaderKBFSKeyGenOffset(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	displayName := fus[0].Username + "," + fus[1].Username
	team, _, _, err := LookupOrCreateImplicitTeam(context.TODO(), tcs[0].G, displayName, false)
	require.NoError(t, err)

	tlfID := newImplicitTLFID(false)
	key1 := [32]byte{0, 1}
	key2 := [32]byte{0, 2}
	cryptKeys := []keybase1.CryptKey{keybase1.CryptKey{
		KeyGeneration: 1,
		Key:           key1,
	}, keybase1.CryptKey{
		KeyGeneration: 2,
		Key:           key2,
	}}
	require.NoError(t, team.AssociateWithTLFKeyset(context.TODO(), tlfID, cryptKeys,
		keybase1.TeamApplication_KBFS))
	team, err = Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID: team.ID,
	})
	require.NoError(t, err)
	keys, err := team.AllApplicationKeysWithKBFS(context.TODO(), keybase1.TeamApplication_KBFS)
	require.NoError(t, err)

	// TODO -- See CORE-9677 - fix this test to switch users to test the refresher, since if Alice does the update
	// herself, her load is autorefreshed after bugfixes in CORE-9663.
	require.Equal(t, 3, len(keys))
	require.Equal(t, 1, keys[0].Generation())
	key3 := keys[2].Key // See above TODO, this is also wonky

	team, err = Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID: team.ID,
		Refreshers: keybase1.TeamRefreshers{
			NeedApplicationsAtGenerationsWithKBFS: map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication{
				3: []keybase1.TeamApplication{keybase1.TeamApplication_KBFS},
			},
		},
	})

	require.NoError(t, err)
	keys, err = team.AllApplicationKeysWithKBFS(context.TODO(), keybase1.TeamApplication_KBFS)
	require.NoError(t, err)
	require.Equal(t, 3, len(keys))
	key, err := team.ApplicationKeyAtGenerationWithKBFS(context.TODO(), keybase1.TeamApplication_KBFS, 1)
	require.NoError(t, err)
	require.Equal(t, 1, key.Generation())
	require.True(t, bytes.Equal(key1[:], key.Key[:]))
	key, err = team.ApplicationKeyAtGenerationWithKBFS(context.TODO(), keybase1.TeamApplication_KBFS, 3)
	require.NoError(t, err)
	require.Equal(t, 3, key.Generation())
	require.True(t, bytes.Equal(key3[:], key.Key[:]))
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
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "mysubteam", teamName, keybase1.TeamRole_NONE /* addSelfAs */)
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
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "mysubteam", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
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
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "mysubteam", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
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
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "mysubteam", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
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
	_, err := CreateSubteam(context.TODO(), tcs[0].G, "abc", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	t.Logf("create a sub-subteam")
	subTeamName, err := parentName.Append("abc")
	require.NoError(t, err)
	subsubteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "def", subTeamName, keybase1.TeamRole_NONE /* addSelfAs */)
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
	subteamID, err := CreateSubteam(context.TODO(), tcs[2].G, "sub", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
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
		require.ElementsMatch(t, impAdmins, expectedSet)
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
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "bbb", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
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
	require.NoError(t, err)

	t.Logf("U0 does an admin action to A.B")
	_, err = AddMember(context.TODO(), tcs[0].G, subteamName.String(), fus[0].Username, keybase1.TeamRole_READER)
	require.NoError(t, err)

	t.Logf("U1 loads A.B")
	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          subteamID,
		ForceRepoll: true,
	})
	require.NoError(t, err, "load team")
}

// Test that a link can be inflated even if the person who signed the (valid) link has since
// lost permission to do so.
func TestInflateAfterPermissionsChange(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	// U1 is the user that signed a link and then lost permissions
	// U2 is the user that inflates a link signed by U1

	t.Logf("U0 creates fennel_network")
	rootName, rootID := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 to the root")
	_, err := AddMember(context.Background(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("U1 creates fennel_network.lair")
	subteamLairID, err := CreateSubteam(context.Background(), tcs[1].G, "lair", rootName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)
	subteamLairName, err := rootName.Append("lair")
	require.NoError(t, err)

	t.Logf("U1 creates fennel_network.chitchat")
	subteamChitchatID, err := CreateSubteam(context.Background(), tcs[1].G, "chitchat", rootName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)
	subteamChitchatName, err := rootName.Append("chitchat")
	require.NoError(t, err)

	t.Logf("U0 removes U1")
	err = RemoveMember(context.Background(), tcs[0].G, rootName.String(), fus[1].Username)
	require.NoError(t, err)

	t.Logf("U0 adds U2 to chitchat")
	_, err = AddMember(context.Background(), tcs[0].G, subteamChitchatName.String(), fus[2].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U2 loads chitchat (thereby loading the root with the new_subteam:lair link stubbed out)")
	_, err = Load(context.Background(), tcs[2].G, keybase1.LoadTeamArg{
		ID:          *subteamChitchatID,
		ForceRepoll: true,
	})
	require.NoError(t, err, "load team chitchat")

	t.Logf("check that the link is stubbed in storage")
	mctx := libkb.NewMetaContextForTest(*tcs[2])
	rootData, frozen, tombstoned := tcs[2].G.GetTeamLoader().(*TeamLoader).storage.Get(mctx, rootID, rootID.IsPublic())
	require.NotNil(t, rootData, "root team should be cached")
	require.False(t, frozen)
	require.False(t, tombstoned)
	require.True(t, (TeamSigChainState{rootData.Chain}).HasAnyStubbedLinks(), "root team should have a stubbed link")

	t.Logf("U0 adds U2 to lair")
	_, err = AddMember(context.Background(), tcs[0].G, subteamLairName.String(), fus[2].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U2 loads lair (which requires inflating the new_subteam:lair link)")
	_, err = Load(context.Background(), tcs[2].G, keybase1.LoadTeamArg{
		ID:          *subteamLairID,
		ForceRepoll: true,
	})
	require.NoError(t, err, "load team lair")
}

// Test loading a team where a rotate_key was signed by implicit-admin + explicit-reader
func TestRotateSubteamByExplicitReader(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates fennel_network")
	rootName, _ := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 to the root")
	_, err := AddMember(context.Background(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("U0 creates fennel_network.sub1")
	subteamID, err := CreateSubteam(context.Background(), tcs[0].G, "sub1", rootName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)
	subteamName, err := rootName.Append("sub1")
	require.NoError(t, err)

	t.Logf("U0 adds both users to the subteam as readers")
	for i := range tcs {
		_, err := AddMember(context.Background(), tcs[0].G, subteamName.String(), fus[i].Username, keybase1.TeamRole_READER)
		require.NoError(t, err)
	}

	t.Logf("U0 rotates the subteam")
	err = RotateKey(context.Background(), tcs[0].G, *subteamID)
	require.NoError(t, err)

	t.Logf("Both users can still load the team")
	for i := range tcs {
		_, err = Load(context.Background(), tcs[i].G, keybase1.LoadTeamArg{
			ID:          *subteamID,
			ForceRepoll: true,
		})
		require.NoError(t, err, "load as %v", i)
	}
}

// TestLoaderCORE_7201 tests a case that came up.
// A user had trouble loading A.B because the cached object was stuck as secretless.
// U1 is an   ADMIN in A
// U1 is only IMP implicitly in A.B
// U1 is a    WRITER in A.B.C
func TestLoaderCORE_7201(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates A")
	rootName, rootID := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 to A")
	_, err := AddMember(context.TODO(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err, "add member")

	t.Logf("U0 creates A.B")
	subBName, subBID := createSubteam(tcs[0], rootName, "bbb")

	t.Logf("U0 creates A.B.C")
	subCName, subCID := createSubteam(tcs[0], subBName, "ccc")

	t.Logf("U0 adds U1 to A.B.C")
	_, err = AddMember(context.TODO(), tcs[0].G, subCName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err, "add member")
	t.Logf("setup complete")

	t.Logf("U1 loads and caches A.B.C")
	// Causing A.B to get cached. Secretless?
	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          subCID,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	t.Logf("U1 loads A")
	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          rootID,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	t.Logf("U1 loads A.B")
	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          subBID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
}

// TestLoaderCORE_8445 tests a case that came up.
// A user had trouble loading A.B because the cached object was stuck as without RKMs.
// U1 is an   ADMIN in A
// U1 is only IMP implicitly in A.B
// U1 is loads A.B caching the secret but not the RKMs
// U1 is a    WRITER A.B
func TestLoaderCORE_8445(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates A")
	rootName, _ := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 to A")
	_, err := AddMember(context.TODO(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err, "add member")

	t.Logf("U0 creates A.B")
	subBName, subBID := createSubteam(tcs[0], rootName, "bbb")

	t.Logf("U1 loads and caches A.B")
	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          subBID,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	t.Logf("U0 adds U1 to A.B")
	_, err = AddMember(context.TODO(), tcs[0].G, subBName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err, "add member")
	t.Logf("setup complete")

	t.Logf("U1 loads A.B without refreshing")
	subBStale, err := Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID: subBID,
	})
	// We're missing RKM data
	require.NoError(t, err)
	require.NotNil(t, subBStale.Data)
	require.False(t, subBStale.Data.Secretless)
	require.NotNil(t, subBStale.Data.PerTeamKeySeedsUnverified)
	_, ok := subBStale.Data.PerTeamKeySeedsUnverified[1]
	require.True(t, ok)
	require.NotNil(t, subBStale.Data.ReaderKeyMasks)
	require.Len(t, subBStale.Data.ReaderKeyMasks[keybase1.TeamApplication_CHAT], 0, "missing rkms")

	t.Logf("U1 loads A.B with refreshing")
	subB, err := Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID: subBID,
		Refreshers: keybase1.TeamRefreshers{
			NeedApplicationsAtGenerations: map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication{
				keybase1.PerTeamKeyGeneration(1): []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
			},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, subB.Data)
	require.False(t, subB.Data.Secretless)
	require.NotNil(t, subB.Data.PerTeamKeySeedsUnverified)
	_, ok = subB.Data.PerTeamKeySeedsUnverified[1]
	require.True(t, ok)
	require.NotNil(t, subB.Data.ReaderKeyMasks)
	require.Len(t, subB.Data.ReaderKeyMasks[keybase1.TeamApplication_CHAT], 1, "number of chat rkms")
}

// Earlier versions of the app didn't store the merkle head in the TeamChainState, but
// we need it to perform an audit. This code tests the path that refetches that data
// from the server.
func TestLoaderUpgradeMerkleHead(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()
	tc.G.Env.Test.TeamNoHeadMerkleStore = true

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

// Load a team where a writer wrote a kbfs link.
func TestLoaderKBFSWriter(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates A")
	rootName, rootID := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 as a writer")
	_, err := AddMember(context.Background(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U1 associates a tlf ID")
	err = CreateTLF(context.Background(), tcs[1].G, keybase1.CreateTLFArg{
		TeamID: rootID,
		TlfID:  randomTlfID(t),
	})
	require.NoError(t, err)

	t.Logf("users can still load the team")

	_, err = Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID:          rootID,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	_, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          rootID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
}

func TestLoaderCORE_10487(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates A")
	rootName, _ := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 to A")
	_, err := AddMember(context.Background(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_OWNER)
	require.NoError(t, err, "add member")

	t.Logf("U0 creates A.B")
	subBName, subBID := createSubteam(tcs[0], rootName, "bbb")

	t.Logf("U0 creates A.B.C")
	subsubCName, subsubCID := createSubteam(tcs[0], subBName, "ccc")

	t.Logf("U1 loads A.B.C (to cache A.B)")
	_, err = Load(context.Background(), tcs[1].G, keybase1.LoadTeamArg{
		ID:          subsubCID,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	t.Logf("U1 loads A.B (to check cache)")
	team, err := Load(context.Background(), tcs[1].G, keybase1.LoadTeamArg{
		ID: subBID,
	})
	require.NoError(t, err)
	t.Logf("Expect missing KBFS RKMs (1)")
	require.NoError(t, err)
	require.NotNil(t, team.Data)
	require.False(t, team.Data.Secretless)
	require.NotNil(t, team.Data.PerTeamKeySeedsUnverified)
	_, ok := team.Data.PerTeamKeySeedsUnverified[1]
	require.True(t, ok)
	require.NotNil(t, team.Data.ReaderKeyMasks)
	require.Len(t, team.Data.ReaderKeyMasks[keybase1.TeamApplication_KBFS], 0, "missing rkms")

	t.Logf("U1 self-promotes in A.B")
	_, err = AddMember(context.Background(), tcs[1].G, subBName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("U1 self-promotes in A.B.C")
	_, err = AddMember(context.Background(), tcs[1].G, subsubCName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("U1 loads A.B")
	team, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID: subBID,
	})
	t.Logf("Expect missing KBFS RKMs (2)")
	require.NoError(t, err)
	require.NotNil(t, team.Data)
	require.False(t, team.Data.Secretless)
	require.NotNil(t, team.Data.PerTeamKeySeedsUnverified)
	_, ok = team.Data.PerTeamKeySeedsUnverified[1]
	require.True(t, ok)
	require.NotNil(t, team.Data.ReaderKeyMasks)
	require.Len(t, team.Data.ReaderKeyMasks[keybase1.TeamApplication_KBFS], 0, "missing rkms")

	t.Logf("U1 loads A.B like KBFS")
	_, err = LoadTeamPlusApplicationKeys(context.Background(), tcs[1].G, subBID,
		keybase1.TeamApplication_KBFS, keybase1.TeamRefreshers{
			NeedApplicationsAtGenerationsWithKBFS: map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication{
				keybase1.PerTeamKeyGeneration(1): []keybase1.TeamApplication{
					keybase1.TeamApplication_KBFS,
				},
			}}, true)
	// When the bug was in place, this produced:
	// "You don't have access to KBFS for this team libkb.KeyMaskNotFoundError"
	require.NoError(t, err)
}

func randomTlfID(t *testing.T) keybase1.TLFID {
	suffix := byte(0x29)
	idBytes, err := libkb.RandBytesWithSuffix(16, suffix)
	require.NoError(t, err)
	return keybase1.TLFID(hex.EncodeToString(idBytes))
}

func getFastStorageFromG(g *libkb.GlobalContext) *FTLStorage {
	tl := g.GetFastTeamLoader().(*FastTeamChainLoader)
	return tl.storage
}

type freezeF = func(*libkb.TestContext, *kbtest.FakeUser, keybase1.TeamID, keybase1.TeamName, *libkb.TestContext) error

func freezeTest(t *testing.T, freezeAction freezeF, unfreezeAction freezeF) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	rootName, rootID := createTeam2(*tcs[0])

	_, err := AddMember(context.Background(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_OWNER)
	require.NoError(t, err)

	// Explicitly load in FTL since AddMember doesn't do it
	mctx := libkb.NewMetaContextForTest(*tcs[0])
	_, err = tcs[0].G.GetFastTeamLoader().Load(mctx, keybase1.FastTeamLoadArg{
		ID:     rootID,
		Public: rootID.IsPublic(),
	})
	require.NoError(t, err)

	err = freezeAction(tcs[0], fus[0], rootID, rootName, tcs[1])
	require.NoError(t, err)

	st := getStorageFromG(tcs[0].G)
	td, frozen, tombstoned := st.Get(mctx, rootID, rootID.IsPublic())
	require.NotNil(t, td)
	require.True(t, frozen)
	require.False(t, tombstoned)
	require.Nil(t, td.ReaderKeyMasks)
	require.NotNil(t, td.Chain)
	require.NotNil(t, td.Chain.LastSeqno)
	require.NotNil(t, td.Chain.LastLinkID)
	require.Nil(t, td.Chain.UserLog)
	require.Nil(t, td.Chain.PerTeamKeys)
	fastS := getFastStorageFromG(tcs[0].G)
	ftd, frozen, tombstoned := fastS.Get(mctx, rootID, rootID.IsPublic())
	require.NotNil(t, ftd)
	require.True(t, frozen)
	require.False(t, tombstoned)
	require.NotNil(t, ftd.Chain)
	require.Nil(t, ftd.ReaderKeyMasks)
	require.Nil(t, ftd.Chain.PerTeamKeys)
	require.NotNil(t, ftd.Chain.ID)
	require.NotNil(t, ftd.Chain.Public)
	require.NotNil(t, ftd.Chain.Last)
	require.NotNil(t, ftd.Chain.Last.Seqno)
	require.NotNil(t, ftd.Chain.Last.LinkID)

	err = unfreezeAction(tcs[0], fus[0], rootID, rootName, tcs[1])
	require.NoError(t, err)

	// Load chains again, forcing repoll
	_, err = tcs[0].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:     rootID,
		Public: rootID.IsPublic(),
	})
	require.NoError(t, err)
	_, err = tcs[0].G.GetFastTeamLoader().Load(mctx, keybase1.FastTeamLoadArg{
		ID:     rootID,
		Public: rootID.IsPublic(),
	})
	require.NoError(t, err)

	td, frozen, tombstoned = st.Get(mctx, rootID, rootID.IsPublic())
	require.NotNil(t, td)
	require.NotNil(t, td.ReaderKeyMasks)
	require.NotNil(t, td.Chain.UserLog)
	require.NotNil(t, td.Chain.PerTeamKeys)
	ftd, frozen, tombstoned = fastS.Get(mctx, rootID, rootID.IsPublic())
	require.NotNil(t, ftd)
	require.False(t, frozen)
	require.False(t, tombstoned)
	require.NotNil(t, ftd.Chain)
	require.NotNil(t, ftd.ReaderKeyMasks)
	require.NotNil(t, ftd.Chain.PerTeamKeys)
	require.NotNil(t, ftd.Chain.ID)
	require.NotNil(t, ftd.Chain.Public)
	require.NotNil(t, ftd.Chain.Last)
	require.NotNil(t, ftd.Chain.Last.Seqno)
	require.NotNil(t, ftd.Chain.Last.LinkID)
}

func TestFreezeBasic(t *testing.T) {
	freezeTest(t, func(tc *libkb.TestContext, fu *kbtest.FakeUser, teamID keybase1.TeamID, _ keybase1.TeamName, _ *libkb.TestContext) error {
		return FreezeTeam(libkb.NewMetaContextForTest(*tc), teamID)
	}, func(tc *libkb.TestContext, fu *kbtest.FakeUser, teamID keybase1.TeamID, _ keybase1.TeamName, _ *libkb.TestContext) error {
		return nil
	})
}

func TestFreezeViaLeave(t *testing.T) {
	freezeTest(t, func(tc *libkb.TestContext, fu *kbtest.FakeUser, teamID keybase1.TeamID, teamName keybase1.TeamName, _ *libkb.TestContext) error {
		return Leave(context.TODO(), tc.G, teamName.String(), false)
	}, func(tc *libkb.TestContext, fu *kbtest.FakeUser, teamID keybase1.TeamID, teamName keybase1.TeamName, otherTc *libkb.TestContext) error {
		_, err := AddMember(context.TODO(), otherTc.G, teamName.String(), fu.Username, keybase1.TeamRole_READER)
		return err
	})
}

func TestTombstoneViaDelete(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	rootName, rootID := createTeam2(*tcs[0])
	_, err := AddMember(context.Background(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_OWNER)
	require.NoError(t, err)

	// Explicitly load in FTL since AddMember doesn't do it
	mctx := libkb.NewMetaContextForTest(*tcs[0])
	_, err = tcs[0].G.GetFastTeamLoader().Load(mctx, keybase1.FastTeamLoadArg{
		ID:     rootID,
		Public: rootID.IsPublic(),
	})
	require.NoError(t, err)

	err = Delete(context.TODO(), tcs[0].G, &teamsUI{}, rootName.String())
	require.NoError(t, err)

	st := getStorageFromG(tcs[0].G)
	td, frozen, tombstoned := st.Get(mctx, rootID, rootID.IsPublic())
	require.NotNil(t, td)
	require.False(t, frozen)
	require.True(t, tombstoned)
	require.Nil(t, td.ReaderKeyMasks)
	require.NotNil(t, td.Chain)
	require.NotNil(t, td.Chain.LastSeqno)
	require.NotNil(t, td.Chain.LastLinkID)
	require.Nil(t, td.Chain.UserLog)
	require.Nil(t, td.Chain.PerTeamKeys)

	fastS := getFastStorageFromG(tcs[0].G)
	ftd, frozen, tombstoned := fastS.Get(mctx, rootID, rootID.IsPublic())
	require.NotNil(t, ftd)
	require.False(t, frozen)
	require.True(t, tombstoned)
	require.NotNil(t, ftd.Chain)
	require.Nil(t, ftd.ReaderKeyMasks)
	require.Nil(t, ftd.Chain.PerTeamKeys)
	require.NotNil(t, ftd.Chain.ID)
	require.NotNil(t, ftd.Chain.Public)
	require.NotNil(t, ftd.Chain.Last)

	// Load chains again, should error due to tombstone
	_, err = tcs[0].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:     rootID,
		Public: rootID.IsPublic(),
	})
	require.NotNil(t, err)
	_, ok := err.(*TeamTombstonedError)
	require.True(t, ok)
	_, err = tcs[0].G.GetFastTeamLoader().Load(mctx, keybase1.FastTeamLoadArg{
		ID:     rootID,
		Public: rootID.IsPublic(),
	})
	require.NotNil(t, err)
	_, ok = err.(*TeamTombstonedError)
	require.True(t, ok)
}
