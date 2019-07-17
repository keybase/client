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
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up ann (%s)", ann.username)

	bob := tt.addUser("bob")
	t.Logf("Signed up bob (%s)", bob.username)

	displayName := strings.Join([]string{ann.username, bob.username}, ",")
	iteam, err := ann.lookupImplicitTeam(true /*create*/, displayName, false /*isPublic*/)
	require.NoError(t, err)
	t.Logf("team created (%s)", iteam)

	iteam2, err := ann.lookupImplicitTeam(false /*create*/, displayName, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, iteam, iteam2, "second lookup should return same team")
	t.Logf("team looked up before reset")

	bob.reset()
	t.Logf("Reset bob (%s)", bob.username)

	iteam3, err := ann.lookupImplicitTeam(false /*create*/, displayName, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, iteam, iteam3, "lookup after reset should return same team")
	t.Logf("team looked up before reset")
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

func TestImplicitTeamResetAndSBSBringback(t *testing.T) {
	// 1. ann and bob (both PUKful) make imp team
	// 2. bob resets
	// 3. bob doesn't get a PUK
	// 4. ann re-adds bob (this just adds invite link, doesn't remove old PUKful bob)
	// 5. bob gets a PUK
	// 6. he should be automatically brought back as crypto member by alice
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up ann (%s)", ann.username)

	bob := tt.addUser("bob")
	t.Logf("Signed up bob (%s)", bob.username)

	// (1)
	displayName := strings.Join([]string{ann.username, bob.username}, ",")
	iteam, err := ann.lookupImplicitTeam(true /* create */, displayName, false /* isPublic */)
	require.NoError(t, err)
	t.Logf("impteam created for %q (id: %s)", displayName, iteam)

	bob.kickTeamRekeyd()
	bob.reset()                  // (2)
	bob.loginAfterResetPukless() // (3)

	ann.reAddUserAfterReset(iteam, bob) // (4)

	teamObj := ann.loadTeamByID(iteam, true)
	nextSeqno := teamObj.NextSeqno()

	bob.perUserKeyUpgrade() // (5)

	t.Logf("Bob upgraded puk, polling for seqno %d", nextSeqno)
	ann.pollForTeamSeqnoLinkWithLoadArgs(keybase1.LoadTeamArg{ID: iteam}, nextSeqno) // (6)

	pollForTrue(t, ann.tc.G, func(i int) bool {
		teamObj = ann.loadTeamByID(iteam, true)
		role, err := teamObj.MemberRole(context.Background(), bob.userVersion())
		require.NoError(t, err)
		return role == keybase1.TeamRole_OWNER
	})

	invites := teamObj.GetActiveAndObsoleteInvites()
	require.Equal(t, 0, len(invites), "leftover invite")
}

func testImplicitResetParametrized(t *testing.T, startPUK, getPUKAfter bool) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up ann (%s)", ann.username)

	var bob *userPlusDevice
	if startPUK {
		bob = tt.addUser("bob")
		t.Logf("Signed up bob (%s)", bob.username)
	} else {
		bob = tt.addPuklessUser("bob")
		t.Logf("Signed up PUKless bob (%s)", bob.username)
	}

	displayName := strings.Join([]string{ann.username, bob.username}, ",")
	iteam, err := ann.lookupImplicitTeam(true /* create */, displayName, false /* isPublic */)
	require.NoError(t, err)
	t.Logf("impteam created for %q (id: %s)", displayName, iteam)

	ann.kickTeamRekeyd()
	bob.reset()
	if getPUKAfter {
		// Bob resets and gets a PUK afterwards
		bob.loginAfterReset()
	} else {
		// Bob resets and does not get a PUK.
		bob.loginAfterResetPukless()
	}

	iteam2, err := ann.lookupImplicitTeam(false /* create */, displayName, false /* isPublic */)
	require.NoError(t, err)
	require.Equal(t, iteam, iteam2)

	if startPUK {
		// Wait for rotation after bob resets.
		ann.waitForAnyRotateByID(iteam2, keybase1.Seqno(1), keybase1.Seqno(1))
	}
	ann.reAddUserAfterReset(iteam, bob)

	if !getPUKAfter {
		teamObj := ann.loadTeamByID(iteam, true)

		// Bob is not a crypto member so no "real" role
		role, err := teamObj.MemberRole(context.Background(), bob.userVersion())
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamRole_NONE, role)

		// but should have active invite
		invite, uv, found := teamObj.FindActiveKeybaseInvite(bob.uid)
		require.True(t, found)
		require.EqualValues(t, bob.userVersion(), uv)
		require.Equal(t, keybase1.TeamRole_OWNER, invite.Role)

		// bob upgrades PUK
		bob.kickTeamRekeyd()
		bob.perUserKeyUpgrade()

		// Wait for SBS
		expectedSeqno := keybase1.Seqno(3)
		ann.pollForTeamSeqnoLinkWithLoadArgs(keybase1.LoadTeamArg{ID: iteam}, expectedSeqno)
	}

	teamObj := ann.loadTeamByID(iteam, true)

	// Bob is now a real crypto member!
	role, err := teamObj.MemberRole(context.Background(), bob.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_OWNER, role)

	// Make sure we are still getting the same team.
	iteam3, err := ann.lookupImplicitTeam(false /* create */, displayName, false /* isPublic */)
	require.Equal(t, iteam, iteam3)
	require.NoError(t, err)
}

func TestImplicitTeamResetNoPUKtoNoPUK(t *testing.T) {
	testImplicitResetParametrized(t, false /* startPUK */, false /* getPUKAfter */)
}

func TestImplicitTeamResetNoPUKtoPUK(t *testing.T) {
	testImplicitResetParametrized(t, false /* startPUK */, true /* getPUKAfter */)
}

func TestImplicitTeamResetPUKtoNoPUK(t *testing.T) {
	// We are lucky this case even works, it breaks the rules a little
	// bit: there is no way to post removeMember+addInvite in one
	// link, so when PUKful bob resets and ann re-adds him as PUKless,
	// only invite link is posted. So technically there are 3 active
	// people in the team at the time:
	//   ann, PUKful bob, PUKless (invited) bob.

	testImplicitResetParametrized(t, true /* startPUK */, false /* getPUKAfter */)
}

func TestImplicitTeamResetNoPukEncore(t *testing.T) {
	// 1. ann and bob (both PUKful) make imp team
	// 2. bob resets
	// 3. bob doesn't get a PUK
	// 4. ann re-adds bob (this just adds invite link, doesn't remove old PUKful bob)
	// (up to this point, this case is tested in
	// TestImplicitResetPUKtoNoPUK and TestChatSrvUserReset)
	// 5. now bob resets again, but this time gets a PUK
	// 6. when they are re-added, old PUKful bob is removed to make
	//    room for new PUK-ful bob, and old invite is also sweeped
	//    (completed).
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up ann (%s)", ann.username)

	bob := tt.addUser("bob")
	t.Logf("Signed up bob (%s)", bob.username)

	// (1)
	displayName := strings.Join([]string{ann.username, bob.username}, ",")
	iteam, err := ann.lookupImplicitTeam(true /* create */, displayName, false /* isPublic */)
	require.NoError(t, err)
	t.Logf("impteam created for %q (id: %s)", displayName, iteam)

	bob.reset()                  // (2)
	bob.loginAfterResetPukless() // (3)

	ann.reAddUserAfterReset(iteam, bob) // (4)

	bob.reset() // (5)
	bob.loginAfterReset()

	ann.reAddUserAfterReset(iteam, bob) // (6)

	teamObj := ann.loadTeamByID(iteam, true)
	role, err := teamObj.MemberRole(context.Background(), bob.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_OWNER, role)

	invites := teamObj.GetActiveAndObsoleteInvites()
	require.Equal(t, 0, len(invites), "leftover invite")
}

func TestImplicitTeamResetBadReadds(t *testing.T) {
	// Check if we can't ruin implicit team state by bad re-adds.
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")
	pam := tt.addPuklessUser("pam")

	displayName := strings.Join([]string{ann.username, bob.username, pam.username}, ",")
	iteam, err := ann.lookupImplicitTeam(true /* create */, displayName, false /* isPublic */)
	require.NoError(t, err)
	t.Logf("impteam created for %q (id: %s)", displayName, iteam)

	bob.reset()
	bob.loginAfterResetPukless()
	t.Logf("%s reset and is now PUKless", bob.username)

	teamObj := ann.loadTeamByID(iteam, true /* admin */)
	_, err = teamObj.InviteMember(context.Background(), bob.username, keybase1.TeamRole_READER, libkb.NewNormalizedUsername(bob.username), bob.userVersion())
	require.Error(t, err)
	t.Logf("Error of InviteMember(bob, READER) is: %v", err)

	pam.reset()
	pam.loginAfterResetPukless()
	t.Logf("%s reset and is now PUKless again", pam.username)

	_, err = teamObj.InviteMember(context.Background(), pam.username, keybase1.TeamRole_READER, libkb.NewNormalizedUsername(pam.username), pam.userVersion())
	require.Error(t, err)
	t.Logf("Error of InviteMember(pam, READER) is: %v", err)
}
