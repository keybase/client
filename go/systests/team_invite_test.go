package systests

import (
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestTeamInviteRooter(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("own")
	tt.addUser("roo")

	// user 0 creates a team
	teamID, teamName := tt.users[0].createTeam2()

	// user 0 adds a rooter user before the rooter user has proved their
	// keybase account
	rooterUser := tt.users[1].username + "@rooter"
	tt.users[0].addTeamMember(teamName.String(), rooterUser, keybase1.TeamRole_WRITER)

	// user 1 proves rooter, kicking rekeyd so it notices the proof
	// beforehand so user 0 can notice proof faster.
	tt.users[1].kickTeamRekeyd()
	tt.users[1].proveRooter()

	// user 0 should get gregor notification that the team changed
	tt.users[0].waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	// user 1 should also get gregor notification that the team changed
	tt.users[1].waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	// the team should have user 1 in it now as a writer
	t0, err := teams.GetTeamByNameForTest(context.TODO(), tt.users[0].tc.G, teamName.String(), false, true)
	if err != nil {
		t.Fatal(err)
	}
	writers, err := t0.UsersWithRole(keybase1.TeamRole_WRITER)
	if err != nil {
		t.Fatal(err)
	}
	if len(writers) != 1 {
		t.Fatalf("num writers: %d, expected 1", len(writers))
	}
	if !writers[0].Uid.Equal(tt.users[1].uid) {
		t.Errorf("writer uid: %s, expected %s", writers[0].Uid, tt.users[1].uid)
	}

	// the invite should not be in the active invite map
	exists, err := t0.HasActiveInvite(keybase1.TeamInviteName(tt.users[1].username), "rooter")
	require.NoError(t, err)
	require.False(t, exists)
	require.Equal(t, 0, t0.NumActiveInvites())
	require.Equal(t, 0, len(t0.GetActiveAndObsoleteInvites()))
}

func TestTeamInviteEmail(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("own")
	tt.addUser("eml")

	// user 0 creates a team
	teamID, teamName := tt.users[0].createTeam2()

	// user 0 adds a user by email
	email := tt.users[1].username + "@keybase.io"
	tt.users[0].addTeamMemberEmail(teamName.String(), email, keybase1.TeamRole_WRITER)

	// user 1 gets the email
	tokens := tt.users[1].readInviteEmails(email)

	// user 1 accepts all invitations
	tt.users[1].kickTeamRekeyd()
	for _, token := range tokens {
		tt.users[1].acceptEmailInvite(token)
	}

	// user 0 should get gregor notification that the team changed
	tt.users[0].waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	// user 1 should also get gregor notification that the team changed
	tt.users[1].waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	// the team should have user 1 in it now as a writer
	t0, err := teams.GetTeamByNameForTest(context.TODO(), tt.users[0].tc.G, teamName.String(), false, true)
	if err != nil {
		t.Fatal(err)
	}
	writers, err := t0.UsersWithRole(keybase1.TeamRole_WRITER)
	if err != nil {
		t.Fatal(err)
	}
	if len(writers) != 1 {
		t.Fatalf("num writers: %d, expected 1", len(writers))
	}
	if !writers[0].Uid.Equal(tt.users[1].uid) {
		t.Errorf("writer uid: %s, expected %s", writers[0].Uid, tt.users[1].uid)
	}

	// the invite should not be in the active invite map
	exists, err := t0.HasActiveInvite(keybase1.TeamInviteName(email), "email")
	if err != nil {
		t.Fatal(err)
	}
	if exists {
		t.Error("after accepting invite, active invite still exists")
	}
}

func TestTeamInviteAcceptOrRequest(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("own")
	tt.addUser("eml")

	// user 0 creates a team
	teamID, teamName := tt.users[0].createTeam2()

	// user 1 requests access
	ret := tt.users[1].acceptInviteOrRequestAccess(teamName.String())
	require.EqualValues(t, ret, keybase1.TeamAcceptOrRequestResult{WasTeamName: true})

	// user 0 adds a user by email
	email := tt.users[1].username + "@keybase.io"
	tt.users[0].addTeamMemberEmail(teamName.String(), email, keybase1.TeamRole_WRITER)

	// user 1 gets the email
	tokens := tt.users[1].readInviteEmails(email)
	require.Len(t, tokens, 1)

	// user 1 accepts the invitation
	tt.users[1].kickTeamRekeyd()
	ret = tt.users[1].acceptInviteOrRequestAccess(tokens[0])
	require.EqualValues(t, ret, keybase1.TeamAcceptOrRequestResult{WasToken: true})

	// user 0 should get gregor notification that the team changed
	tt.users[0].waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	// user 1 should also get gregor notification that the team changed
	tt.users[1].waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	// the team should have user 1 in it now as a writer
	t0, err := teams.GetTeamByNameForTest(context.TODO(), tt.users[0].tc.G, teamName.String(), false, true)
	require.NoError(t, err)
	writers, err := t0.UsersWithRole(keybase1.TeamRole_WRITER)
	require.NoError(t, err)
	require.Len(t, writers, 1)
	if !writers[0].Uid.Equal(tt.users[1].uid) {
		t.Errorf("writer uid: %s, expected %s", writers[0].Uid, tt.users[1].uid)
	}
}

// bob resets and added to team with no keys, logs in and invite should
// be processed.
func TestTeamInviteResetNoKeys(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("own")

	// user 0 creates a team
	teamID, teamName := tt.users[0].createTeam2()

	// user 0 should get gregor notification that the team changed and rotated key
	tt.users[0].waitForTeamChangedAndRotated(teamID, keybase1.Seqno(1))

	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)
	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	tt.users[0].addTeamMember(teamName.String(), bob.username, keybase1.TeamRole_WRITER)
	divDebug(ctx, "Added bob as a writer")

	// user 0 kicks rekeyd so it notices the puk
	tt.users[0].kickTeamRekeyd()

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	// user 0 should get gregor notification that the team changed
	tt.users[0].waitForTeamChangedGregor(teamID, keybase1.Seqno(3))
}

// See if we can re-invite user after they reset and thus make their
// first invitation obsolete.
func TestTeamReInviteAfterReset(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")

	// Ann creates a team.
	teamID, teamName := ann.createTeam2()
	t.Logf("Created team %q", teamName.String())

	bob := ctx.installKeybaseForUserNoPUK("bob", 10)
	bob.signupNoPUK()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	// Try to add bob to team, should add an invitation because bob is PUK-less.
	ann.addTeamMember(teamName.String(), bob.username, keybase1.TeamRole_WRITER) // Invitation 1

	// Reset, invalidates invitation 1.
	bob.reset()
	bob.loginAfterResetNoPUK(10)

	// Try to add again (bob still doesn't have a PUK). Adding this
	// invitation should automatically cancel first invitation.
	ann.addTeamMember(teamName.String(), bob.username, keybase1.TeamRole_ADMIN) // Invitation 2

	t.Logf("Trying to get a PUK")

	bob.primaryDevice().tctx.Tp.DisableUpgradePerUserKey = false

	ann.kickTeamRekeyd()
	err := bob.perUserKeyUpgrade()
	require.NoError(t, err)

	t.Logf("Bob got a PUK, now let's see if Ann's client adds him to team")

	ann.waitForTeamChangedGregor(teamID, keybase1.Seqno(4))

	details, err := ann.teamsClient.TeamGet(context.TODO(), keybase1.TeamGetArg{Name: teamName.String(), ForceRepoll: true})
	require.NoError(t, err)

	// Bob should have became an admin, because the second invitations
	// should have been used, not the first one.
	require.Equal(t, len(details.Members.Admins), 1)
	require.Equal(t, details.Members.Admins[0].Username, bob.username)
}

func testImpTeamWithRooterParametrized(t *testing.T, public bool) {
	t.Logf("testImpTeamWithRooterParametrized(public=%t)", public)

	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("alice")
	bob := tt.addUser("bob")
	tt.logUserNames()

	rooterUser := bob.username + "@rooter"
	displayName := strings.Join([]string{alice.username, rooterUser}, ",")

	team, err := alice.lookupImplicitTeam(true /*create*/, displayName, public)
	require.NoError(t, err)

	t.Logf("Created implicit team %v\n", team)

	// TODO: Test chats, but it might be hard since implicit team tlf
	// name resolution for chat commands needs KBFS running.
	bob.kickTeamRekeyd()
	bob.proveRooter()

	alice.waitForTeamChangedGregor(team, keybase1.Seqno(2))

	// Poll for new team name, without the "@rooter"
	newDisplayName := strings.Join([]string{alice.username, bob.username}, ",")

	lookupAs := func(u *userPlusDevice) {
		team2, err := u.lookupImplicitTeam(false /*create*/, newDisplayName, public)
		require.NoError(t, err)
		require.Equal(t, team, team2)

		// Lookup by old name should get the same result
		team2, err = u.lookupImplicitTeam(false /*create*/, displayName, public)
		require.NoError(t, err)
		require.Equal(t, team, team2)

		// Test resolver
		_, err = teams.ResolveIDToName(context.Background(), u.tc.G, team)
		require.NoError(t, err)
	}

	lookupAs(alice)
	lookupAs(bob)

	if public {
		doug := tt.addUser("doug")
		t.Logf("Signed up %s (%s) to test public access", doug.username, doug.uid)

		lookupAs(doug)
	}
}

func TestImpTeamWithRooter(t *testing.T) {
	testImpTeamWithRooterParametrized(t, false /* public */)
	testImpTeamWithRooterParametrized(t, true /* public */)
}

func TestImpTeamWithRooterConflict(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("alice")
	bob := tt.addUser("bob")

	displayNameRooter := strings.Join([]string{alice.username, bob.username + "@rooter"}, ",")

	team, err := alice.lookupImplicitTeam(true /*create*/, displayNameRooter, false /*isPublic*/)
	require.NoError(t, err)

	t.Logf("Created implicit team %q -> %s\n", displayNameRooter, team)

	// Bob has not proven rooter yet, so this will create a new, separate team.
	displayNameKeybase := strings.Join([]string{alice.username, bob.username}, ",")
	team2, err := alice.lookupImplicitTeam(true /*create*/, displayNameKeybase, false /*isPublic*/)
	require.NoError(t, err)
	require.NotEqual(t, team, team2)

	t.Logf("Created implicit team %q -> %s\n", displayNameKeybase, team2)

	bob.kickTeamRekeyd()
	bob.proveRooter()

	alice.waitForTeamChangedGregor(team, keybase1.Seqno(2))

	// Display name with rooter name now points to the conflict winner.
	team3, err := alice.lookupImplicitTeam(false /*create*/, displayNameRooter, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, team2, team3)

	// "LookupOrCreate" rooter name should work as well.
	team3, err = alice.lookupImplicitTeam(true /*create*/, displayNameRooter, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, team2, team3)

	// The original name works as well.
	_, err = alice.lookupImplicitTeam(false /*create*/, displayNameKeybase, false /*isPublic*/)
	require.NoError(t, err)
}

func TestImpTeamWithMultipleRooters(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("ali")
	bob := tt.addUser("bob")
	charlie := tt.addUser("cha")

	// Both teams include social assertions, so there is no definitive conflict winner.
	displayNameRooter1 := strings.Join([]string{alice.username, bob.username, charlie.username + "@rooter"}, ",")
	displayNameRooter2 := strings.Join([]string{alice.username, bob.username + "@rooter", charlie.username}, ",")

	team1, err := alice.lookupImplicitTeam(true /*create*/, displayNameRooter1, false /*isPublic*/)
	require.NoError(t, err)

	team2, err := alice.lookupImplicitTeam(true /*create*/, displayNameRooter2, false /*isPublic*/)
	require.NoError(t, err)

	require.NotEqual(t, team1, team2)

	alice.kickTeamRekeyd()
	bob.proveRooter()
	charlie.proveRooter()

	toSeqno := keybase1.Seqno(2)
	var found bool
	for i := 0; i < 10; i++ {
		select {
		case arg := <-alice.notifications.changeCh:
			t.Logf("membership change received: %+v", arg)
			if (arg.TeamID.Eq(team1) || arg.TeamID.Eq(team2)) && arg.Changes.MembershipChanged && !arg.Changes.KeyRotated && !arg.Changes.Renamed && arg.LatestSeqno == toSeqno {
				t.Logf("change matched with %q", arg.TeamID)
				found = true
				break
			}
		case <-time.After(1 * time.Second):
		}
	}

	require.True(t, found) // Expect "winning team" to be found.

	displayName := strings.Join([]string{alice.username, bob.username, charlie.username}, ",")
	teamFinal, err := alice.lookupImplicitTeam(false /*create*/, displayName, false /*isPublic*/)
	require.NoError(t, err)
	require.True(t, teamFinal == team1 || teamFinal == team2)

	tid, err := alice.lookupImplicitTeam(false /*create*/, displayNameRooter1, false /*isPublic*/)
	t.Logf("looking up team %s gives %v %v", displayNameRooter1, tid, err)
	require.NoError(t, err)
	require.Equal(t, teamFinal, tid)

	tid, err = alice.lookupImplicitTeam(false /*create*/, displayNameRooter2, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, teamFinal, tid)
	t.Logf("looking up team %s gives %v %v", displayNameRooter2, tid, err)
}

func TestClearSocialInvitesOnAdd(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	// Disable gregor in this test so Ann does not immediately add Bob
	// through SBS handler when bob proves Rooter.
	ann := makeUserStandalone(t, "ann", standaloneUserArgs{
		disableGregor:            true,
		suppressTeamChatAnnounce: true,
	})
	tt.users = append(tt.users, ann)

	tracer := ann.tc.G.CTimeTracer(context.Background(), "test-tracer", true)
	defer tracer.Finish()

	tracer.Stage("bob")
	bob := tt.addUser("bob")

	tracer.Stage("team")
	team := ann.createTeam()

	t.Logf("Ann created team %q", team)

	bobBadRooter := "other" + bob.username

	tracer.Stage("add 1")
	ann.addTeamMember(team, bob.username+"@rooter", keybase1.TeamRole_WRITER)
	tracer.Stage("add 2")
	ann.addTeamMember(team, bobBadRooter+"@rooter", keybase1.TeamRole_WRITER)

	tracer.Stage("prove rooter")
	bob.proveRooter()

	// Because bob@rooter is now proven by bob, this will add bob as a
	// member instead of making an invitation.
	tracer.Stage("add 3")
	ann.addTeamMember(team, bob.username+"@rooter", keybase1.TeamRole_WRITER)

	tracer.Stage("get team")
	t0, err := teams.GetTeamByNameForTest(context.TODO(), ann.tc.G, team, false, true)
	require.NoError(t, err)

	tracer.Stage("assertions")
	writers, err := t0.UsersWithRole(keybase1.TeamRole_WRITER)
	require.NoError(t, err)
	require.Equal(t, len(writers), 1)
	require.True(t, writers[0].Uid.Equal(bob.uid))

	hasInv, err := t0.HasActiveInvite(keybase1.TeamInviteName(bob.username), "rooter")
	require.NoError(t, err)
	require.False(t, hasInv, "Adding should have cleared bob...@rooter")

	hasInv, err = t0.HasActiveInvite(keybase1.TeamInviteName(bobBadRooter), "rooter")
	require.NoError(t, err)
	require.True(t, hasInv, "But should not have cleared otherbob...@rooter")
}

func TestSweepObsoleteKeybaseInvites(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	// Disable gregor in this test so Ann does not immediately add Bob
	// through SBS handler when bob gets PUK.
	ann := makeUserStandalone(t, "ann", standaloneUserArgs{
		disableGregor:            true,
		suppressTeamChatAnnounce: true,
	})
	tt.users = append(tt.users, ann)

	// Get UIDMapper caching out of the equation - assume in real
	// life, tested actions are spread out in time and caching is not
	// an issue.
	ann.tc.G.UIDMapper.SetTestingNoCachingMode(true)

	bob := tt.addPuklessUser("bob")
	t.Logf("Signed up PUK-less user bob (%s)", bob.username)

	team := ann.createTeam()
	t.Logf("Team created (%s)", team)

	ann.addTeamMember(team, bob.username, keybase1.TeamRole_WRITER)

	bob.perUserKeyUpgrade()
	t.Logf("Bob (%s) gets PUK", bob.username)

	teamObj, err := teams.Load(context.Background(), ann.tc.G, keybase1.LoadTeamArg{
		Name:        team,
		ForceRepoll: true,
		NeedAdmin:   true,
	})
	require.NoError(t, err)

	// Use ChangeMembership to add bob without sweeping his keybase
	// invite.
	err = teamObj.ChangeMembership(context.Background(), keybase1.TeamChangeReq{
		Writers: []keybase1.UserVersion{bob.userVersion()},
	})
	require.NoError(t, err)

	// Bob then leaves team.
	bob.leave(team)

	teamObj, err = teams.Load(context.Background(), ann.tc.G, keybase1.LoadTeamArg{
		Name:        team,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	// Invite should be obsolete, so there are 0 active invites...
	require.Equal(t, 0, teamObj.NumActiveInvites())

	// ...but one in "all invites".
	allInvites := teamObj.GetActiveAndObsoleteInvites()
	require.Equal(t, 1, len(allInvites))

	var invite keybase1.TeamInvite
	for _, invite = range allInvites {
		break // get the only invite returned
	}
	require.Equal(t, bob.userVersion().TeamInviteName(), invite.Name)

	// Simulate SBS message to Ann trying to re-add Bob.
	sbsMsg := keybase1.TeamSBSMsg{
		TeamID: teamObj.ID,
		Score:  0,
		Invitees: []keybase1.TeamInvitee{
			keybase1.TeamInvitee{
				InviteID:    invite.Id,
				Uid:         bob.uid,
				EldestSeqno: 1,
				Role:        keybase1.TeamRole_WRITER,
			},
		},
	}

	err = teams.HandleSBSRequest(context.Background(), ann.tc.G, sbsMsg)
	require.Error(t, err)
	require.IsType(t, libkb.NotFoundError{}, err)

	teamObj, err = teams.Load(context.Background(), ann.tc.G, keybase1.LoadTeamArg{
		Name:        team,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	// Bob should still be out of the team.
	role, err := teamObj.MemberRole(context.Background(), bob.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_NONE, role)
}

func teamInviteRemoveIfHigherRole(t *testing.T, waitForRekeyd bool) {
	t.Logf("teamInviteRemoveIfHigherRole(waitForRekeyd=%t)", waitForRekeyd)

	tt := newTeamTester(t)
	defer tt.cleanup()

	var own *userPlusDevice
	if waitForRekeyd {
		own = tt.addUser("own")
	} else {
		own = makeUserStandalone(t, "own", standaloneUserArgs{
			disableGregor:            true,
			suppressTeamChatAnnounce: true,
		})
		tt.users = append(tt.users, own)
	}
	roo := tt.addUser("roo")
	tt.logUserNames()

	teamID, teamName := own.createTeam2()
	own.addTeamMember(teamName.String(), roo.username, keybase1.TeamRole_ADMIN)
	own.addTeamMember(teamName.String(), roo.username+"@rooter", keybase1.TeamRole_WRITER)

	t.Logf("Created team %s", teamName.String())

	if waitForRekeyd {
		own.kickTeamRekeyd()
	}
	roo.proveRooter()

	if waitForRekeyd {
		// 3 links at this point: root, change_membership (add "roo"),
		// invite (add "roo@rooter"). Waiting for 4th link: invite
		// (cancel "roo@rooter").
		own.pollForTeamSeqnoLink(teamName.String(), keybase1.Seqno(4))
	} else {
		teamObj := own.loadTeamByID(teamID, true /* admin */)
		var invite keybase1.TeamInvite
		invites := teamObj.GetActiveAndObsoleteInvites()
		require.Len(t, invites, 1)
		for _, invite = range invites {
			// Get the (only) invite from the map to local variable
		}

		rooUv := roo.userVersion()

		err := teams.HandleSBSRequest(context.Background(), own.tc.G, keybase1.TeamSBSMsg{
			TeamID: teamID,
			Score:  0,
			Invitees: []keybase1.TeamInvitee{
				keybase1.TeamInvitee{
					InviteID:    invite.Id,
					Uid:         rooUv.Uid,
					EldestSeqno: rooUv.EldestSeqno,
				},
			},
		})
		require.NoError(t, err)
	}

	// SBS handler should have canceled the invite after discovering roo is
	// already a member with higher role.
	teamObj := own.loadTeamByID(teamID, true /* admin */)
	require.Len(t, teamObj.GetActiveAndObsoleteInvites(), 0)
	role, err := teamObj.MemberRole(context.Background(), roo.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_ADMIN, role)
}

func TestTeamInviteRemoveIfHigherRole(t *testing.T) {
	// This test is parametrized. waitForRekeyd=true will wait for
	// real rekeyd notification, waitForRekeyd=false will call SBS
	// handler manually.
	teamInviteRemoveIfHigherRole(t, true /* waitForRekeyd */)
	teamInviteRemoveIfHigherRole(t, false /* waitForRekeyd */)
}

func testTeamInviteSweepOldMembers(t *testing.T, startPUKless bool) {
	t.Logf(":: testTeamInviteSweepOldMembers(startPUKless: %t)", startPUKless)

	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	var roo *userPlusDevice
	if startPUKless {
		roo = tt.addPuklessUser("roo")
	} else {
		roo = tt.addUser("roo")
	}
	tt.logUserNames()

	teamID, teamName := own.createTeam2()
	own.addTeamMember(teamName.String(), roo.username, keybase1.TeamRole_WRITER)
	own.addTeamMember(teamName.String(), roo.username+"@rooter", keybase1.TeamRole_ADMIN)

	t.Logf("Created team %s", teamName.String())

	roo.kickTeamRekeyd()
	roo.reset()
	roo.loginAfterReset()

	roo.proveRooter()

	// 3 links to created team, add roo, and add roo@rooter.
	// + 2 links (rotate, change_membership) to add roo in startPUKless=false case;
	// or +2 links (change_membersip, cancel invite) to add roo in startPUKless=true case.
	own.pollForTeamSeqnoLink(teamName.String(), keybase1.Seqno(5))

	teamObj := own.loadTeamByID(teamID, true /* admin */)
	// 0 total invites: rooter invite was completed, and keybase invite was sweeped
	require.Len(t, teamObj.GetActiveAndObsoleteInvites(), 0)
	role, err := teamObj.MemberRole(context.Background(), roo.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_ADMIN, role)

	members, err := teamObj.Members()
	require.NoError(t, err)
	require.Len(t, members.Owners, 1)
	require.Len(t, members.Admins, 1)
}

func TestTeamInviteSweepOldMembers(t *testing.T) {
	testTeamInviteSweepOldMembers(t, false)
	testTeamInviteSweepOldMembers(t, true)
}
