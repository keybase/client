package systests

import (
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestImplicitTeamRotateOnRevokePrivate(t *testing.T) {
	testImplicitTeamRotateOnRevoke(t, false)
}

func TestImplicitTeamRotateOnRevokePublic(t *testing.T) {
	testImplicitTeamRotateOnRevoke(t, true)
}

func testImplicitTeamRotateOnRevoke(t *testing.T, public bool) {
	t.Logf("public: %v", public)
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("alice")
	bob := tt.addUserWithPaper("bob")

	iTeamName := strings.Join([]string{alice.username, bob.username}, ",")

	t.Logf("make an implicit team")
	team, err := alice.lookupImplicitTeam(true /*create*/, iTeamName, public)
	require.NoError(t, err)

	// get the before state of the team
	before, err := GetTeamForTestByID(context.TODO(), alice.tc.G, team, public)
	require.NoError(t, err)
	require.Equal(t, keybase1.PerTeamKeyGeneration(1), before.Generation())
	secretBefore := before.Data.PerTeamKeySeedsUnverified[before.Generation()].Seed.ToBytes()

	bob.revokePaperKey()
	alice.waitForRotateByID(team, keybase1.Seqno(2))

	// check that key was rotated for team
	after, err := GetTeamForTestByID(context.TODO(), alice.tc.G, team, public)
	require.NoError(t, err)
	require.Equal(t, keybase1.PerTeamKeyGeneration(2), after.Generation(), "generation after rotate")

	secretAfter := after.Data.PerTeamKeySeedsUnverified[after.Generation()].Seed.ToBytes()
	if libkb.SecureByteArrayEq(secretAfter, secretBefore) {
		t.Fatal("team secret did not change when rotated")
	}
}

// Invites should be visible to everyone for implicit teams.
// Even readers.
func TestImplicitTeamInviteVisibilityPrivate(t *testing.T) {
	testImplicitTeamInviteVisibility(t, false)
}

func TestImplicitTeamInviteVisibilityPublic(t *testing.T) {
	testImplicitTeamInviteVisibility(t, true)
}

func testImplicitTeamInviteVisibility(t *testing.T, public bool) {
	t.Logf("public: %v", public)

	tt := newTeamTester(t)
	defer tt.cleanup()

	// Alice is a writer
	alice := tt.addUser("alice")
	// Bob is a writer by social assertion (proved partway through test)
	bob := tt.addUser("bob")
	// Char is a pukless writer
	char := tt.addPuklessUser("char")
	// test-private: Drake is a reader
	// test-public: Drake is not a member
	drake := tt.addUser("drake")

	bobSocial := fmt.Sprintf("%v@rooter", bob.username)

	impteamName := fmt.Sprintf("%v,%v,%v#%v", alice.username, bobSocial, char.username, drake.username)
	if public {
		impteamName = fmt.Sprintf("%v,%v,%v", alice.username, bobSocial, char.username)
	}

	t.Logf("impteamName: %v", impteamName)
	teamID, err := alice.lookupImplicitTeam(true /*create*/, impteamName, public)
	require.NoError(t, err)
	_ = teamID

	assertions := func(rooterDone bool) {
		lookupRes, err := drake.lookupImplicitTeam2(false /*create*/, impteamName, public)
		require.NoError(t, err)
		require.Equal(t, teamID, lookupRes.TeamID)
		require.Equal(t, public, lookupRes.DisplayName.IsPublic)

		team, err := teams.Load(context.TODO(), drake.tc.G, keybase1.LoadTeamArg{
			ID:          lookupRes.TeamID,
			Public:      public,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		require.True(t, team.IsImplicit())

		// Assert that `list` and `users` are the same set.
		// Ignores EldestSeqno, just uses UID.
		// Sorts list in place
		assertUvSet := func(actual []keybase1.UserVersion, expected ...*userPlusDevice) {
			require.Len(t, actual, len(expected))
			// Sort both by uid and compare
			sort.Slice(actual, func(i, j int) bool {
				return actual[i].Uid < actual[j].Uid
			})
			sort.Slice(expected, func(i, j int) bool {
				return expected[i].uid < expected[j].uid
			})
			for i, expected1 := range expected {
				actual1 := actual[i]
				require.Equal(t, expected1.uid, actual1.Uid, "%v", expected1.username)
			}
		}

		t.Logf("check the Team object")
		members, err := team.Members()
		require.NoError(t, err)
		t.Logf("members: %v", spew.Sdump(members))
		if !rooterDone {
			assertUvSet(members.Owners, alice)
			require.Equal(t, 2, team.NumActiveInvites(), "bob (social) and char (pukless)")
		} else {
			assertUvSet(members.Owners, alice, bob)
			require.Equal(t, 1, team.NumActiveInvites(), "char (pukless)")
		}
		assertUvSet(members.Admins)
		assertUvSet(members.Writers)
		if public {
			assertUvSet(members.Readers)
		} else {
			assertUvSet(members.Readers, drake)
		}

		t.Logf("check the ImplicitTeamDisplayName from LookupImplicitTeam: %v", spew.Sdump(lookupRes.DisplayName))
		if !rooterDone {
			require.Len(t, lookupRes.DisplayName.Writers.KeybaseUsers, 2, "alice, char (pukless)")
			require.Len(t, lookupRes.DisplayName.Writers.UnresolvedUsers, 1, "bob (rooter)")
		} else {
			require.Len(t, lookupRes.DisplayName.Writers.KeybaseUsers, 3, "alice, bob (resolved), char (pukless)")
			require.Len(t, lookupRes.DisplayName.Writers.UnresolvedUsers, 0)
		}
		require.Len(t, lookupRes.DisplayName.Readers.UnresolvedUsers, 0)
		if public {
			require.Len(t, lookupRes.DisplayName.Readers.KeybaseUsers, 0)
		} else {
			require.Len(t, lookupRes.DisplayName.Readers.KeybaseUsers, 1)
		}
	}

	assertions(false)

	bob.proveRooter()

	t.Logf("wait for someone to add bob")
	pollForConditionWithTimeout(t, 10*time.Second, "bob to be added to the team after rooter proof", func(ctx context.Context) bool {
		team, err := teams.Load(ctx, drake.tc.G, keybase1.LoadTeamArg{
			ID:          teamID,
			Public:      public,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		role, err := team.MemberRole(ctx, bob.userVersion())
		require.NoError(t, err)
		return role != keybase1.TeamRole_NONE
	})

	assertions(true)
}

// Poll until the condition is satisfied.
// Fails the test and returns after the timeout.
func pollForConditionWithTimeout(t *testing.T, timeout time.Duration, description string, condition func(context.Context) bool) {
	pollCtx, pollCancel := context.WithCancel(context.Background())
	defer pollCancel()
	successCh := make(chan struct{})

	// Start polling
	go func(ctx context.Context) {
		for {
			if condition(ctx) {
				successCh <- struct{}{}
				return
			}
			time.Sleep(300 * time.Millisecond)
		}
	}(pollCtx)

	// Wait for success or timeout
	select {
	case <-successCh:
	case <-time.After(30 * time.Second):
		pollCancel()
		t.Fatalf("timed out waiting for condition: %v", description)
	}
}

func trySBSConsolidation(t *testing.T, impteamExpr string, public bool) {
	t.Logf("trySBSConsolidation(expr=%q, public=%t)", impteamExpr, public)

	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")
	tt.logUserNames()

	impteamName := fmt.Sprintf(impteamExpr, ann.username, bob.username, bob.username)
	teamID, err := ann.lookupImplicitTeam(true /* create */, impteamName, public)
	require.NoError(t, err)

	t.Logf("Created team %s -> %s", impteamName, teamID)

	bob.kickTeamRekeyd()
	bob.proveRooter()
	t.Logf("Bob (%s) proved rooter", bob.username)

	expectedTeamName := fmt.Sprintf("%v,%v", ann.username, bob.username)
	pollForConditionWithTimeout(t, 10*time.Second, "team consolidated to ann,bob", func(ctx context.Context) bool {
		team, err := teams.Load(ctx, ann.tc.G, keybase1.LoadTeamArg{
			ID:          teamID,
			ForceRepoll: true,
			Public:      public,
		})
		require.NoError(t, err)
		displayName, err := team.ImplicitTeamDisplayName(context.Background())
		require.NoError(t, err)
		t.Logf("Got team back: %q (waiting for %q)", displayName.String(), expectedTeamName)
		return displayName.String() == expectedTeamName
	})

	teamID2, err := ann.lookupImplicitTeam(false /* create */, expectedTeamName, public)
	require.NoError(t, err)
	require.Equal(t, teamID, teamID2)

	_, err = teams.ResolveIDToName(context.Background(), ann.tc.G, teamID2)
	require.NoError(t, err)

	if public {
		pam := tt.addUser("pam")
		t.Logf("Signed up %s (%s) for public team check", pam.username, pam.uid)
		teamID3, err := pam.lookupImplicitTeam(false /* create */, impteamName, true /* public */)
		require.NoError(t, err)
		require.Equal(t, teamID2, teamID3)

		_, err = teams.Load(context.Background(), pam.tc.G, keybase1.LoadTeamArg{
			ID:          teamID3,
			ForceRepoll: true,
			Public:      true,
		})
		require.NoError(t, err)

		_, err = teams.ResolveIDToName(context.Background(), pam.tc.G, teamID3)
		require.NoError(t, err)
	}
}

func trySBSConsolidationPubAndPriv(t *testing.T, impteamExpr string) {
	trySBSConsolidation(t, impteamExpr, true /* public */)
	trySBSConsolidation(t, impteamExpr, false /* public */)
}

func TestImplicitSBSConsolidation(t *testing.T) {
	trySBSConsolidationPubAndPriv(t, "%v,%v,%v@rooter")
}

func TestImplicitSBSPromotion(t *testing.T) {
	trySBSConsolidationPubAndPriv(t, "%v,%v@rooter#%v")
}

func TestImplicitSBSConsolidation2(t *testing.T) {
	// Test "downgrade" case, where it should not downgrade if social
	// assertion is a reader. Result should still be "ann,bob", not
	// "ann#bob".

	trySBSConsolidationPubAndPriv(t, "%v,%v#%v@rooter")
}

func TestImplicitSBSPukless(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addPuklessUser("bob")
	t.Logf("Signed ann (%s) and pukless bob (%s)", ann.username, bob.username)

	impteamName := fmt.Sprintf("%s,%s@rooter", ann.username, bob.username)
	teamID, err := ann.lookupImplicitTeam(true /* create */, impteamName, false)
	require.NoError(t, err)

	t.Logf("Created team %s -> %s", impteamName, teamID)

	bob.proveRooter()

	// Because of a bug in team provisional status checking combined
	// with how lookupImplicitTeam works, this load is busted right
	// now:

	// Loading "alice,bob@rooter" resolves "alice" to "alice", and
	// "bob@rooter" to "bob", and it "redirects" the load to
	// "alice,bob". But "alice,bob" cannot be loaded because
	// "alice,bob" implicit team will not exist until alice completes
	// "bob@rooter" invite. Team server blocks team load until that to
	// prevent races.

	t.Logf(":: Trying to load %q", impteamName)
	_, err = ann.lookupImplicitTeam(false /* create */, impteamName, false)
	require.Error(t, err)
	//require.Equal(t, teamID, teamID2)
	t.Logf("Loading %s failed with: %v", impteamName, err)

	// The following load call will not work as well. So this team is
	// essentially locked until bob gets PUK and alice keys him in.

	expectedTeamName := fmt.Sprintf("%v,%v", ann.username, bob.username)
	t.Logf(":: Trying to load %q", expectedTeamName)
	_, err = ann.lookupImplicitTeam(false /* create */, expectedTeamName, false)
	require.Error(t, err)
	t.Logf("Loading %s failed with: %v", expectedTeamName, err)

	bob.kickTeamRekeyd()
	bob.perUserKeyUpgrade()

	pollForConditionWithTimeout(t, 10*time.Second, "team resolved to ann,bob", func(ctx context.Context) bool {
		team, err := teams.Load(ctx, ann.tc.G, keybase1.LoadTeamArg{
			ID:          teamID,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		displayName, err := team.ImplicitTeamDisplayName(context.Background())
		require.NoError(t, err)
		t.Logf("Got team back: %s", displayName.String())
		return displayName.String() == expectedTeamName
	})

	teamID3, err := ann.lookupImplicitTeam(false /* create */, expectedTeamName, false)
	require.NoError(t, err)
	require.Equal(t, teamID, teamID3)
}

func TestResolveSBSTeamWithConflict(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")

	// Create two implicit teams that will become conflicted later:
	// - alice,bob
	// - alice,bob@rooter
	impteamName1 := fmt.Sprintf("%s,%s", ann.username, bob.username)
	_, err := ann.lookupImplicitTeam(true /* create */, impteamName1, false /* public */)
	require.NoError(t, err)

	impteamName2 := fmt.Sprintf("%s,%s@rooter", ann.username, bob.username)
	_, err = ann.lookupImplicitTeam(true /* create */, impteamName2, false /* public */)
	require.NoError(t, err)

	// Make sure we can resolve them right now and get two different team IDs.
	teamid1, err := ann.lookupImplicitTeam(false /* create */, impteamName1, false /* public */)
	require.NoError(t, err)

	teamid2, err := ann.lookupImplicitTeam(false /* create */, impteamName2, false /* public */)
	require.NoError(t, err)

	require.NotEqual(t, teamid1, teamid2)

	// Make sure we can load these teams.
	teamObj1 := ann.loadTeamByID(teamid1, true /* admin */)
	teamObj2 := ann.loadTeamByID(teamid2, true /* admin */)

	// Check display names with conflicts, teams are not in conflict right now
	// (ImplicitTeamDisplayNameString returns display name with suffix).
	name, err := teamObj1.ImplicitTeamDisplayNameString(context.Background())
	require.NoError(t, err)
	require.Equal(t, impteamName1, name)
	t.Logf("Team 1 display name is: %s", name)
	name, err = teamObj2.ImplicitTeamDisplayNameString(context.Background())
	require.NoError(t, err)
	require.Equal(t, impteamName2, name)
	t.Logf("Team 2 (w/ rooter) display name is: %s", name)

	// Bob proves rooter.
	bob.kickTeamRekeyd()
	bob.proveRooter()

	// Wait till team2 resolves.
	ann.pollForTeamSeqnoLinkWithLoadArgs(keybase1.LoadTeamArg{
		ID:          teamid2,
		ForceRepoll: true,
	}, keybase1.Seqno(2))

	// Make sure teams are still loadable by ID.
	teamObj1 = ann.loadTeamByID(teamid1, true /* admin */)
	teamObj2 = ann.loadTeamByID(teamid2, true /* admin */)

	// Team1 display name with suffix should stay unchanged.
	name, err = teamObj1.ImplicitTeamDisplayNameString(context.Background())
	require.NoError(t, err)
	t.Logf("After resolution, team1 display name is: %s", name)
	require.Equal(t, impteamName1, name)

	// See if we can resolve implicit team by name without suffix and get the
	// first team.
	lookupTeamID, err := ann.lookupImplicitTeam(false /* create */, name, false /* public */)
	require.NoError(t, err)
	require.Equal(t, teamid1, lookupTeamID)

	// Team 2 should be the one that gets conflict suffix.
	name, err = teamObj2.ImplicitTeamDisplayNameString(context.Background())
	require.NoError(t, err)
	t.Logf("After resolution, team2 display name is: %s", name)
	require.Contains(t, name, "(conflicted copy")
	require.Contains(t, name, "#1)")

	// We should be able to resolve team2 by name with suffix. This is where
	// the CORE-9732 cache bug was.
	lookupTeamID, err = ann.lookupImplicitTeam(false /* create */, name, false /* public */)
	require.NoError(t, err)
	require.Equal(t, teamid2, lookupTeamID)
}

func TestResolveSBSConsolidatedTeamWithConflict(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")

	// Create two implicit teams that will become conflicted later
	// - alice,bob
	// - alice,bob#bob@rooter
	// The second team will consolidate to "alice,bob", but since there
	// already is "alice,bob", it will become "conflicted copy #1".

	impteamName1 := fmt.Sprintf("%s,%s", ann.username, bob.username)
	_, err := ann.lookupImplicitTeam(true /* create */, impteamName1, false /* public */)
	require.NoError(t, err)

	impteamName2 := fmt.Sprintf("%s,%s#%s@rooter", ann.username, bob.username, bob.username)
	_, err = ann.lookupImplicitTeam(true /* create */, impteamName2, false /* public */)
	require.NoError(t, err)

	// Make sure we can resolve them right now.
	teamid1, err := ann.lookupImplicitTeam(false /* create */, impteamName1, false /* public */)
	require.NoError(t, err)

	teamid2, err := ann.lookupImplicitTeam(false /* create */, impteamName2, false /* public */)
	require.NoError(t, err)

	// Make sure we can load these teams.
	teamObj1 := ann.loadTeamByID(teamid1, true /* admin */)
	teamObj2 := ann.loadTeamByID(teamid2, true /* admin */)

	name, err := teamObj1.ImplicitTeamDisplayNameString(context.Background())
	require.NoError(t, err)
	require.Equal(t, impteamName1, name)
	t.Logf("Team 1 display name is: %s", name)
	name, err = teamObj2.ImplicitTeamDisplayNameString(context.Background())
	require.NoError(t, err)
	require.Equal(t, impteamName2, name)
	t.Logf("Team 2 (w/ rooter) display name is: %s", name)

	// Bob proves rooter.
	bob.kickTeamRekeyd()
	bob.proveRooter()

	// Wait till team2 resolves.
	ann.pollForTeamSeqnoLinkWithLoadArgs(keybase1.LoadTeamArg{
		ID:          teamid2,
		ForceRepoll: true,
	}, keybase1.Seqno(2))

	// Make sure teams are still loadable by ID.
	teamObj1 = ann.loadTeamByID(teamid1, true /* admin */)
	teamObj2 = ann.loadTeamByID(teamid2, true /* admin */)

	name, err = teamObj2.ImplicitTeamDisplayNameString(context.Background())
	require.NoError(t, err)
	t.Logf("Second team became: %s", name)
	require.Contains(t, name, "(conflicted copy")
	require.Contains(t, name, "#1)")

	// See if we can lookup this team.
	lookupTeamID, err := ann.lookupImplicitTeam(false /* create */, name, false /* public */)
	require.NoError(t, err)
	require.Equal(t, teamid2, lookupTeamID)
}
