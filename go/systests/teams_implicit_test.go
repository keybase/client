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
	bob := tt.addUser("bob")

	iTeamName := strings.Join([]string{alice.username, bob.username}, ",")

	t.Logf("make an implicit team")
	team, err := alice.lookupImplicitTeam(true /*create*/, iTeamName, public)
	require.NoError(t, err)

	// get the before state of the team
	before, err := GetTeamForTestByID(context.TODO(), alice.tc.G, team, public)
	require.NoError(t, err)
	require.Equal(t, keybase1.PerTeamKeyGeneration(1), before.Generation())
	secretBefore := before.Data.PerTeamKeySeeds[before.Generation()].Seed.ToBytes()

	bob.revokePaperKey()
	alice.waitForRotateByID(team, keybase1.Seqno(2))

	// check that key was rotated for team
	after, err := GetTeamForTestByID(context.TODO(), alice.tc.G, team, public)
	require.NoError(t, err)
	require.Equal(t, keybase1.PerTeamKeyGeneration(2), after.Generation(), "generation after rotate")

	secretAfter := after.Data.PerTeamKeySeeds[after.Generation()].Seed.ToBytes()
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

func trySBSConsolidation(t *testing.T, impteamExpr string) {
	t.Logf("trySBSConsolidation(%q)", impteamExpr)

	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")

	impteamName := fmt.Sprintf(impteamExpr, ann.username, bob.username, bob.username)
	teamID, err := ann.lookupImplicitTeam(true /* create */, impteamName, false)
	require.NoError(t, err)

	t.Logf("Created team %s -> %s", impteamName, teamID)

	bob.proveRooter()
	t.Logf("Bob (%s) proved rooter", bob.username)

	expectedTeamName := fmt.Sprintf("%v,%v", ann.username, bob.username)
	pollForConditionWithTimeout(t, 10*time.Second, "team consolidated to ann,bob", func(ctx context.Context) bool {
		team, err := teams.Load(ctx, ann.tc.G, keybase1.LoadTeamArg{
			ID:          teamID,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		displayName, err := team.ImplicitTeamDisplayName(context.Background())
		t.Logf("Got team back: %s", displayName.String())
		return displayName.String() == expectedTeamName
	})

	teamID2, err := ann.lookupImplicitTeam(false /* create */, expectedTeamName, false)
	require.NoError(t, err)
	require.Equal(t, teamID, teamID2)
}

func TestImplicitSBSConsolidation(t *testing.T) {
	trySBSConsolidation(t, "%v,%v,%v@rooter")
}

func TestImplicitSBSPromotion(t *testing.T) {
	trySBSConsolidation(t, "%v,%v@rooter#%v")
}

func TestImplicitSBSDowngrade(t *testing.T) {
	// Test "downgrade" case, where it should not downgrade if social
	// assertion is a reader. Result should still be "ann,bob", not
	// "ann#bob".

	trySBSConsolidation(t, "%v,%v#%v@rooter")
}
