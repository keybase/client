package systests

import (
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

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
	team := tt.users[0].createTeam()

	// user 0 adds a rooter user before the rooter user has proved their
	// keybase account
	rooterUser := tt.users[1].username + "@rooter"
	tt.users[0].addTeamMember(team, rooterUser, keybase1.TeamRole_WRITER)

	// user 1 proves rooter
	tt.users[1].proveRooter()

	// user 0 kicks rekeyd so it notices the proof
	tt.users[0].kickTeamRekeyd()

	// user 0 should get gregor notification that the team changed
	tt.users[0].waitForTeamChangedGregor(team, keybase1.Seqno(3))

	// user 1 should also get gregor notification that the team changed
	tt.users[1].waitForTeamChangedGregor(team, keybase1.Seqno(3))

	// the team should have user 1 in it now as a writer
	t0, err := teams.GetTeamByNameForTest(context.TODO(), t, tt.users[0].tc.G, team, false, true)
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
	if err != nil {
		t.Fatal(err)
	}
	if exists {
		t.Error("after accepting invite, active invite still exists")
	}
	require.Equal(t, 0, t0.NumActiveInvites(), "after accepting invite, active invites still exists")
}

func TestTeamInviteEmail(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("own")
	tt.addUser("eml")

	// user 0 creates a team
	team := tt.users[0].createTeam()

	// user 0 adds a user by email
	email := tt.users[1].username + "@keybase.io"
	tt.users[0].addTeamMemberEmail(team, email, keybase1.TeamRole_WRITER)

	// user 1 gets the email
	tokens := tt.users[1].readInviteEmails(email)

	// user 1 accepts all invitations
	for _, token := range tokens {
		tt.users[1].acceptEmailInvite(token)
	}

	// user 0 kicks rekeyd so it notices the accepted invite
	tt.users[0].kickTeamRekeyd()

	// user 0 should get gregor notification that the team changed
	tt.users[0].waitForTeamChangedGregor(team, keybase1.Seqno(3))

	// user 1 should also get gregor notification that the team changed
	tt.users[1].waitForTeamChangedGregor(team, keybase1.Seqno(3))

	// the team should have user 1 in it now as a writer
	t0, err := teams.GetTeamByNameForTest(context.TODO(), t, tt.users[0].tc.G, team, false, true)
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
	team := tt.users[0].createTeam()

	// user 1 requests access
	tt.users[1].acceptInviteOrRequestAccess(team)

	// user 0 adds a user by email
	email := tt.users[1].username + "@keybase.io"
	tt.users[0].addTeamMemberEmail(team, email, keybase1.TeamRole_WRITER)

	// user 1 gets the email
	tokens := tt.users[1].readInviteEmails(email)
	require.Len(t, tokens, 1)

	// user 1 accepts the invitation
	tt.users[1].acceptInviteOrRequestAccess(tokens[0])

	// user 0 kicks rekeyd so it notices the accepted invite
	tt.users[0].kickTeamRekeyd()

	// user 0 should get gregor notification that the team changed
	tt.users[0].waitForTeamChangedGregor(team, keybase1.Seqno(3))

	// user 1 should also get gregor notification that the team changed
	tt.users[1].waitForTeamChangedGregor(team, keybase1.Seqno(3))

	// the team should have user 1 in it now as a writer
	t0, err := teams.GetTeamByNameForTest(context.TODO(), t, tt.users[0].tc.G, team, false, true)
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
	team := tt.users[0].createTeam()

	// user 0 should get gregor notification that the team changed and rotated key
	tt.users[0].waitForTeamChangedAndRotated(team, keybase1.Seqno(1))

	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)
	bob.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)

	tt.users[0].addTeamMember(team, bob.username, keybase1.TeamRole_WRITER)
	divDebug(ctx, "Added bob as a writer")

	// user 0 kicks rekeyd so it notices the puk
	tt.users[0].kickTeamRekeyd()

	bob.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	// user 0 should get gregor notification that the team changed
	tt.users[0].waitForTeamChangedGregor(team, keybase1.Seqno(3))
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
	team := ann.createTeam()
	t.Logf("Created team %q", team)

	ann.waitForTeamChangedAndRotated(team, keybase1.Seqno(1))

	bob := ctx.installKeybaseForUserNoPUK("bob", 10)
	bob.signupNoPUK()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	// Try to add bob to team, should add an invitation because bob is PUK-less.
	ann.addTeamMember(team, bob.username, keybase1.TeamRole_WRITER) // Invitation 1

	// Reset, invalidates invitation 1.
	bob.reset()
	bob.loginAfterResetNoPUK(10)

	// Try to add again (bob still doesn't have a PUK).
	ann.addTeamMember(team, bob.username, keybase1.TeamRole_ADMIN) // Invitation 2

	t.Logf("Trying to get a PUK")

	bob.primaryDevice().tctx.Tp.DisableUpgradePerUserKey = false

	err := bob.perUserKeyUpgrade()
	require.NoError(t, err)

	t.Logf("Bob got a PUK, now let's see if Ann's client adds him to team")

	ann.kickTeamRekeyd()
	ann.waitForTeamChangedGregor(team, keybase1.Seqno(4))

	details, err := ann.teamsClient.TeamGet(context.TODO(), keybase1.TeamGetArg{Name: team, ForceRepoll: true})
	require.NoError(t, err)

	// Bob should have became an admin, because the second invitations
	// should have been used, not the first one.
	require.Equal(t, len(details.Members.Admins), 1)
	require.Equal(t, details.Members.Admins[0].Username, bob.username)
}

func TestImpTeamWithRooter(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("alice")
	bob := tt.addUser("bob")

	rooterUser := bob.username + "@rooter"
	displayName := strings.Join([]string{alice.username, rooterUser}, ",")

	team, err := alice.lookupImplicitTeam(true /*create*/, displayName, false /*isPublic*/)
	require.NoError(t, err)

	t.Logf("Created implicit team %v\n", team)

	// TODO: Test chats, but it might be hard since implicit team tlf
	// name resolution for chat commands needs KBFS running.
	bob.proveRooter()

	alice.kickTeamRekeyd()

	alice.waitForTeamIDChangedGregor(team, keybase1.Seqno(2))

	// Poll for new team name, without the "@rooter"
	newDisplayName := strings.Join([]string{alice.username, bob.username}, ",")

	team2, err := alice.lookupImplicitTeam(false /*create*/, newDisplayName, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, team, team2)

	// Lookup by old name should get the same result
	team2, err = alice.lookupImplicitTeam(false /*create*/, displayName, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, team, team2)
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

	bob.proveRooter()

	alice.kickTeamRekeyd()

	alice.waitForTeamIDChangedGregor(team, keybase1.Seqno(2))

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

	bob.proveRooter()
	charlie.proveRooter()

	alice.kickTeamRekeyd()

	toSeqno := keybase1.Seqno(2)
	var winningTeam keybase1.TeamID
	for i := 0; i < 10; i++ {
		select {
		case arg := <-alice.notifications.rotateCh:
			t.Logf("membership change received: %+v", arg)
			if (arg.TeamID.Eq(team1) || arg.TeamID.Eq(team2)) && arg.Changes.MembershipChanged && !arg.Changes.KeyRotated && !arg.Changes.Renamed && arg.LatestSeqno == toSeqno {
				t.Logf("change matched with %q", arg.TeamID)
				winningTeam = arg.TeamID
				return
			}
		case <-time.After(1 * time.Second):
		}
	}

	displayName := strings.Join([]string{alice.username, bob.username, charlie.username}, ",")
	teamFinal, err := alice.lookupImplicitTeam(false /*create*/, displayName, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, teamFinal, winningTeam)

	team1, err = alice.lookupImplicitTeam(false /*create*/, displayNameRooter1, false /*isPublic*/)
	require.Error(t, err)

	team2, err = alice.lookupImplicitTeam(false /*create*/, displayNameRooter2, false /*isPublic*/)
	require.Error(t, err)
}

func TestClearSocialInvitesOnAdd(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	// Disable gregor in this test so Ann does not immediately add Bob
	// through SBS handler when bob proves Rooter.
	ann := makeUserStandalone(t, "ann", standaloneUserArgs{disableGregor: true})
	tt.users = append(tt.users, ann)

	bob := tt.addUser("bob")

	team := ann.createTeam()

	t.Logf("Ann created team %q", team)

	bobBadRooter := "other" + bob.username

	ann.addTeamMember(team, bob.username+"@rooter", keybase1.TeamRole_WRITER)
	ann.addTeamMember(team, bobBadRooter+"@rooter", keybase1.TeamRole_WRITER)

	bob.proveRooter()

	// Because bob@rooter is now proven by bob, this will add bob as a
	// member instead of making an invitation.
	ann.addTeamMember(team, bob.username+"@rooter", keybase1.TeamRole_WRITER)

	t0, err := teams.GetTeamByNameForTest(context.TODO(), t, ann.tc.G, team, false, true)
	require.NoError(t, err)

	writers, err := t0.UsersWithRole(keybase1.TeamRole_WRITER)
	require.NoError(t, err)
	require.Equal(t, len(writers), 1)
	require.True(t, writers[0].Uid.Equal(bob.uid))

	// Adding should have cleared bob...@rooter
	hasInv, err := t0.HasActiveInvite(keybase1.TeamInviteName(bob.username), "rooter")
	require.NoError(t, err)
	require.False(t, hasInv)

	// But should not have cleared otherbob...@rooter
	hasInv, err = t0.HasActiveInvite(keybase1.TeamInviteName(bobBadRooter), "rooter")
	require.NoError(t, err)
	require.True(t, hasInv)
}
