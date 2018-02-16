package systests

import (
	"strings"
	"testing"

	"golang.org/x/net/context"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	teams "github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

// bob resets, implicit team lookup should still work for ann
func TestImplicitTeamReset(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	divDebug(ctx, "Signed up ann (%s)", ann.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	displayName := strings.Join([]string{ann.username, bob.username}, ",")
	iteam := ann.lookupImplicitTeam(true /*create*/, displayName, false /*isPublic*/)
	divDebug(ctx, "team created (%s)", iteam.ID)

	iteam2 := ann.lookupImplicitTeam(false /*create*/, displayName, false /*isPublic*/)
	require.Equal(t, iteam.ID, iteam2.ID, "second lookup should return same team")
	divDebug(ctx, "team looked up before reset")

	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	iteam3 := ann.lookupImplicitTeam(false /*create*/, displayName, false /*isPublic*/)
	require.Equal(t, iteam.ID, iteam3.ID, "lookup after reset should return same team")
	divDebug(ctx, "team looked up before reset")
}

func TestImplicitTeamUserReset(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	// Sign up two users, bob and alice.
	alice := ctx.installKeybaseForUser("alice", 10)
	alice.signup()
	divDebug(ctx, "Signed up alice (%s)", alice.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	displayName := strings.Join([]string{alice.username, bob.username}, ",")
	team := alice.lookupImplicitTeam(true /*create*/, displayName, false /*isPublic*/)

	divDebug(ctx, "Created implicit team %s\n", team.ID)

	// Reset bob and reprovision.
	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	// Setup team loader on alice
	G := alice.getPrimaryGlobalContext()
	teams.NewTeamLoaderAndInstall(G)

	tryLoad := func(teamID keybase1.TeamID) (res *teams.Team) {
		res, err := teams.Load(context.TODO(), G, keybase1.LoadTeamArg{
			ID:          teamID,
			Public:      teamID.IsPublic(),
			ForceRepoll: true,
		})
		require.NoError(t, err)
		return res
	}

	tryLoad(team.ID)

	getRole := func(username string) keybase1.TeamRole {
		g := G
		loadUserArg := libkb.NewLoadUserArg(g).
			WithNetContext(context.TODO()).
			WithName(username).
			WithPublicKeyOptional().
			WithForcePoll(true)
		upak, _, err := g.GetUPAKLoader().LoadV2(loadUserArg)
		require.NoError(t, err)

		team, err := teams.GetForTeamManagementByTeamID(context.TODO(), g, team.ID, false)
		require.NoError(t, err)
		role, err := team.MemberRole(context.TODO(), upak.Current.ToUserVersion())
		require.NoError(t, err)
		return role
	}

	// Bob's role should be NONE since he's still reset.
	role := getRole(bob.username)
	require.Equal(t, role, keybase1.TeamRole_NONE)

	// Alice re-adds bob.
	alice.reAddUserAfterReset(team, bob)
	divDebug(ctx, "Re-Added bob as an owner")

	// Check if sigchain still plays back correctly
	tryLoad(team.ID)

	// Check if bob is back as OWNER.
	role = getRole(bob.username)
	require.Equal(t, role, keybase1.TeamRole_OWNER)

	// Reset and re-provision bob again.
	bob.reset()
	divDebug(ctx, "Reset bob again (%s) (poor bob)", bob.username)

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	// Check if sigchain plays correctly, check if role is NONE.
	tryLoad(team.ID)

	role = getRole(bob.username)
	require.Equal(t, role, keybase1.TeamRole_NONE)

	// Alice re-adds bob, again.
	alice.reAddUserAfterReset(team, bob)
	divDebug(ctx, "Re-Added bob as an owner again")

	// Check if sigchain plays correctly, at this point there are two
	// sigs similar to:
	//   "change_membership: { owner: ['xxxx%6'], none: ['xxxx%3'] }"
	// with uids and eldest from before and after reset.
	tryLoad(team.ID)

	role = getRole(bob.username)
	require.Equal(t, role, keybase1.TeamRole_OWNER)
}

// ann and bob both reset
func TestImplicitTeamResetAll(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	ann.registerForNotifications()
	divDebug(ctx, "Signed up ann (%s)", ann.username)

	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	bob.registerForNotifications()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	displayName := strings.Join([]string{ann.username, bob.username}, ",")
	iteam := ann.lookupImplicitTeam(true /*create*/, displayName, false /*isPublic*/)
	divDebug(ctx, "team created (%s)", iteam.ID)

	iteam2 := ann.lookupImplicitTeam(false /*create*/, displayName, false /*isPublic*/)
	require.Equal(t, iteam.ID, iteam2.ID, "second lookup should return same team")
	divDebug(ctx, "team looked up before reset")

	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	ann.reset()
	divDebug(ctx, "Reset ann (%s)", ann.username)

	ann.loginAfterReset(10)
	divDebug(ctx, "Ann logged in after reset")

	ann.waitForTeamAbandoned(iteam.ID)

	iteam3 := ann.lookupImplicitTeam(true /*create*/, displayName, false /*isPublic*/)
	require.NotEqual(t, iteam.ID, iteam3.ID, "lookup after resets should return different team")
	divDebug(ctx, "team looked up after resets")
}

func testImplicitResetParametrized(t *testing.T, startPUK, getPUKAfter bool) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 5)
	ann.signup()
	t.Logf("Signed up ann (%s)", ann.username)

	bob := ctx.installKeybaseForUser("bob", 5)
	if startPUK {
		bob.signup()
		t.Logf("Signed up bob (%s)", bob.username)
	} else {
		bob.signupNoPUK()
		t.Logf("Signed up PUKless bob (%s)", bob.username)
	}

	displayName := strings.Join([]string{ann.username, bob.username}, ",")
	iteam := ann.lookupImplicitTeam(true /* create */, displayName, false /* isPublic */)
	t.Logf("impteam created for %q (id: %s)", displayName, iteam.ID)

	bob.reset()
	if getPUKAfter {
		// Bob resets and gets a PUK afterwards
		bob.loginAfterReset(5)
	} else {
		// Bob resets and does not get a PUK.
		bob.loginAfterResetNoPUK(5)
	}

	iteam2 := ann.lookupImplicitTeam(false /* create */, displayName, false /* isPublic */)
	require.Equal(t, iteam.ID, iteam2.ID)

	ann.reAddUserAfterReset(iteam, bob)

	teamObj := ann.loadTeamByID(iteam.ID, true)

	if !getPUKAfter {
		// Bob is not a crypto member so no "real" role
		role, err := teamObj.MemberRole(context.Background(), bob.userVersion())
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamRole_NONE, role)

		// but should have active invite
		invite, uv, found := teamObj.FindActiveKeybaseInvite(bob.uid())
		require.True(t, found)
		require.EqualValues(t, bob.userVersion(), uv)
		require.Equal(t, keybase1.TeamRole_OWNER, invite.Role)

		// bob upgrades PUK
		bob.primaryDevice().tctx.Tp.DisableUpgradePerUserKey = false
		err = bob.perUserKeyUpgrade()
		require.NoError(t, err)

		expectedSeqno := keybase1.Seqno(3)
		if startPUK {
			expectedSeqno = keybase1.Seqno(4) // rotateKey link if crypto user resets.
		}
		ann.pollForTeamSeqnoLinkWithLoadArgs(keybase1.LoadTeamArg{ID: iteam.ID}, expectedSeqno)
	}

	teamObj = ann.loadTeamByID(iteam.ID, true)

	// Bob is now a real crypto member!
	role, err := teamObj.MemberRole(context.Background(), bob.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_OWNER, role)

	// Make sure we are still getting the same team.
	iteam3 := ann.lookupImplicitTeam(false /* create */, displayName, false /* isPublic */)
	require.Equal(t, iteam.ID, iteam3.ID)
}

func TestImplicitResetNoPUKtoNoPUK(t *testing.T) {
	testImplicitResetParametrized(t, false /* startPUK */, false /* getPUKAfter */)
}

func TestImplicitResetNoPUKtoPUK(t *testing.T) {
	testImplicitResetParametrized(t, false /* startPUK */, true /* getPUKAfter */)
}

func TestImplicitResetPUKtoNoPUK(t *testing.T) {
	// We are lucky this case even works, it breaks the rules a little
	// bit: there is no way to post removeMember+addInvite in one
	// link, so when PUKful bob resets and ann readds him as PUKless,
	// only invite link is posted. So technically there are 3 active
	// people in the team at the time:
	//   ann, PUKful bob, PUKless (invited) bob.

	testImplicitResetParametrized(t, true /* startPUK */, false /* getPUKAfter */)
}

func TestImplicitResetNoPukEncore(t *testing.T) {
	// 1. ann and bob (both PUKful) make imp team
	// 2. bob resets
	// 3. bob doesn't get a PUK
	// 4. ann re-adds bob (this just adds invite link, doesn't remove old PUKful bob)
	// (up to this point, this case is tested in
	// TestImplicitResetPUKtoNoPUK and TestChatSrvUserReset)
	// 5. now bob resets again, but this time gets a PUK
	// 6. when they are re-added, old PUKful bob is removed to make
	//    room for new PUK-ful bob, BUT: old invite stays as well,
	//    and is never sweeped by anything :()

	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 5)
	ann.signup()
	t.Logf("Signed up ann (%s)", ann.username)

	bob := ctx.installKeybaseForUser("bob", 5)
	bob.signup()
	t.Logf("Signed up bob (%s)", bob.username)

	displayName := strings.Join([]string{ann.username, bob.username}, ",")
	iteam := ann.lookupImplicitTeam(true /* create */, displayName, false /* isPublic */)
	t.Logf("impteam created for %q (id: %s)", displayName, iteam.ID)

	bob.reset()
	bob.loginAfterResetNoPUK(5)

	ann.reAddUserAfterReset(iteam, bob)

	bob.reset()
	bob.loginAfterReset(5)

	ann.reAddUserAfterReset(iteam, bob)

	teamObj := ann.loadTeamByID(iteam.ID, true)
	role, err := teamObj.MemberRole(context.Background(), bob.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_OWNER, role)

	// commented out so the test doesn't fail.
	// invites := teamObj.GetActiveAndObsoleteInvites()
	// require.Equal(t, 0, len(invites), "leftover invite :(")
}
