package systests

import (
	"testing"

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
	tt.users[1].prooveRooter()

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
	exists, err := t0.HasActiveInvite(tt.users[1].username, "rooter")
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
	exists, err := t0.HasActiveInvite(email, "email")
	if err != nil {
		t.Fatal(err)
	}
	if exists {
		t.Error("after accepting invite, active invite still exists")
	}
}
