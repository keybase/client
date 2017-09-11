package systests

import (
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

	client "github.com/keybase/client/go/client"
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
	t0, err := teams.GetForTeamManagementByStringName(context.TODO(), tt.users[0].tc.G, team, true)
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
	t0, err := teams.GetForTeamManagementByStringName(context.TODO(), tt.users[0].tc.G, team, true)
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
	t0, err := teams.GetForTeamManagementByStringName(context.TODO(), tt.users[0].tc.G, team, true)
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

func prooveRooter(user *smuUser) {
	tctx := user.primaryDevice().popClone()
	runner := client.NewCmdProveRooterRunner(tctx.G, user.username)
	if err := runner.Run(); err != nil {
		user.ctx.t.Fatal(err)
	}
}

func TestImpTeamInvite(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	// Sign up two users
	alice := ctx.installKeybaseForUser("alice", 10)
	alice.signup()
	divDebug(ctx, "Signed up alice (%s)", alice.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	rooterUser := bob.username + "@rooter"
	displayName := strings.Join([]string{alice.username, rooterUser}, ",")

	team := alice.lookupImplicitTeam(true /*create*/, displayName, false /*isPublic*/)

	divDebug(ctx, "Created implicit team %s\n", team.ID)

	// TODO: Test chats, but it might be hard since implicit team tlf
	// name resolution for chat commands needs KBFS running.

	prooveRooter(bob)

	aliceCtx := alice.primaryDevice().popClone()
	kickTeamRekeyd(aliceCtx.G, t)

	// Poll for new team name, without the "@rooter"
	newDisplayName := strings.Join([]string{alice.username, bob.username}, ",")

	var team2 smuImplicitTeam
	var err error
	for i := 0; i < 5; i++ {
		team2, err = alice.lookupImplicitTeamError(false /*create*/, newDisplayName, false /*isPublic*/)
		if err == nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	require.NoError(t, err)
	require.Equal(t, team2.ID, team.ID)

	// Lookup by old name should fail
	_, err = alice.lookupImplicitTeamError(false /*create*/, displayName, false /*isPublic*/)
	require.Error(t, err)
}
