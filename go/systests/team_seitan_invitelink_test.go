package systests

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func TestTeamInviteSeitanInvitelinkHappy(t *testing.T) {
	testTeamInviteSeitanInvitelinkHappy(t, false /* implicitAdmin */)
	testTeamInviteSeitanInvitelinkHappy(t, true /* implicitAdmin */)
}

func testTeamInviteSeitanInvitelinkHappy(t *testing.T, implicitAdmin bool) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("kvr")
	bob := tt.addUser("eci")

	teamIDParent, teamNameParent := alice.createTeam2()
	teamID := teamIDParent
	teamName := teamNameParent
	t.Logf("Created team %v %v", teamIDParent, teamNameParent)
	if implicitAdmin {
		subteamID, err := teams.CreateSubteam(context.TODO(), tt.users[0].tc.G, "sub1", teamNameParent, keybase1.TeamRole_NONE /* addSelfAs */)
		require.NoError(t, err)
		teamID = *subteamID
		subteamName, err := teamNameParent.Append("sub1")
		require.NoError(t, err)
		teamName = subteamName
		t.Logf("Created subteam %v %v", teamID, teamName)
	}

	maxUses, err := keybase1.NewTeamInviteFiniteUses(3)
	require.NoError(t, err)
	etime := keybase1.ToUnixTime(time.Now().Add(24 * time.Hour))
	link, err := alice.teamsClient.TeamCreateSeitanInvitelink(context.TODO(), keybase1.TeamCreateSeitanInvitelinkArg{
		Teamname: teamName.String(),
		Role:     keybase1.TeamRole_WRITER,
		MaxUses:  maxUses,
		Etime:    &etime,
	})
	require.NoError(t, err)

	t.Logf("Created token %v", link)

	details := alice.teamGetDetails(teamName.String())
	require.Len(t, details.AnnotatedActiveInvites, 1)
	for _, aInvite := range details.AnnotatedActiveInvites {
		invite := aInvite.InviteMetadata.Invite
		require.Equal(t, keybase1.TeamRole_WRITER, invite.Role)
		tic, err := invite.Type.C()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamInviteCategory_INVITELINK, tic)
	}

	bob.kickTeamRekeyd()
	err = bob.teamsClient.TeamAcceptInvite(context.TODO(), keybase1.TeamAcceptInviteArg{
		Token: string(link.Ikey),
	})
	require.NoError(t, err)

	t.Logf("User used token, waiting for rekeyd")

	alice.waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	t0, err := teams.GetTeamByNameForTest(context.TODO(), alice.tc.G, teamName.String(), false /* public */, true /* needAdmin */)
	require.NoError(t, err)

	role, err := t0.MemberRole(context.TODO(), teams.NewUserVersion(bob.uid, 1))
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_WRITER)
}

func TestTeamInviteLinkAfterLeave(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("ali")
	bob := tt.addUser("bob")

	teamID, teamName := alice.createTeam2()
	maxUses, err := keybase1.NewTeamInviteFiniteUses(100)
	require.NoError(t, err)
	etime := keybase1.ToUnixTime(time.Now().AddDate(1, 0, 0))
	link, err := alice.teamsClient.TeamCreateSeitanInvitelink(context.TODO(), keybase1.TeamCreateSeitanInvitelinkArg{
		Teamname: teamName.String(),
		Role:     keybase1.TeamRole_WRITER,
		MaxUses:  maxUses,
		Etime:    &etime,
	})
	require.NoError(t, err)

	t.Logf("Created team invite link: %#v", link)

	bob.kickTeamRekeyd()
	err = bob.teamsClient.TeamAcceptInvite(context.TODO(), keybase1.TeamAcceptInviteArg{
		Token: string(link.Ikey),
	})
	require.NoError(t, err)

	alice.waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	// Bob leaves.
	bob.leave(teamName.String())

	// Make sure Bob gets different akey when accepting again, and that Alice
	// doesn't hit the "invite link was accepted before last change membership"
	// when handling seitan.
	clock := clockwork.NewFakeClockAt(time.Now())
	clock.Advance(1 * time.Second)
	bob.tc.G.SetClock(clock)
	alice.tc.G.SetClock(clock)

	// Bob accepts the same invite again.
	err = bob.teamsClient.TeamAcceptInvite(context.TODO(), keybase1.TeamAcceptInviteArg{
		Token: string(link.Ikey),
	})
	require.NoError(t, err)

	alice.waitForTeamChangedGregor(teamID, keybase1.Seqno(5))

	t.Logf("removing bob; expecting to ban since he was added by invitelink most recently")
	alice.removeTeamMember(teamName.String(), bob.username)
	t.Logf("bob tries to rejoin")
	clock.Advance(1 * time.Second)
	err = bob.teamsClient.TeamAcceptInvite(context.TODO(), keybase1.TeamAcceptInviteArg{
		Token: string(link.Ikey),
	})
	require.Error(t, err, "server won't let bob back in")
	appErr, ok := err.(libkb.AppStatusError)
	require.True(t, ok, "got an app err")
	require.Equal(t, appErr.Code, libkb.SCTeamBanned)

	t.Logf("alice adds/removes manually to clear ban")
	alice.addTeamMember(teamName.String(), bob.username, keybase1.TeamRole_WRITER)
	alice.removeTeamMember(teamName.String(), bob.username)

	clock.Advance(1 * time.Second)
	err = bob.teamsClient.TeamAcceptInvite(context.TODO(), keybase1.TeamAcceptInviteArg{
		Token: string(link.Ikey),
	})
	require.NoError(t, err, "bob can rejoin")
	alice.waitForTeamChangedGregor(teamID, keybase1.Seqno(9))
	t0, err := teams.GetTeamByNameForTest(context.TODO(), alice.tc.G,
		teamName.String(), false /* public */, true /* needAdmin */)
	require.NoError(t, err)
	role, err := t0.MemberRole(context.TODO(), teams.NewUserVersion(bob.uid, 1))
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_WRITER)
}

func TestCreateSeitanInvitelinkWithDuration(t *testing.T) {
	// Test for the GUI RPC.

	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("ali")
	_, teamName := alice.createTeam2()

	now := alice.tc.G.Clock().Now()

	maxUses := keybase1.TeamMaxUsesInfinite
	expireAfter := "10 Y"
	_, err := alice.teamsClient.TeamCreateSeitanInvitelinkWithDuration(
		context.TODO(),
		keybase1.TeamCreateSeitanInvitelinkWithDurationArg{
			Teamname:    teamName.String(),
			Role:        keybase1.TeamRole_WRITER,
			MaxUses:     maxUses,
			ExpireAfter: &expireAfter,
		})
	require.NoError(t, err)

	details := alice.teamGetDetails(teamName.String())
	require.Len(t, details.AnnotatedActiveInvites, 1)
	for _, aInvite := range details.AnnotatedActiveInvites {
		invite := aInvite.InviteMetadata.Invite
		require.Equal(t, keybase1.TeamRole_WRITER, invite.Role)
		require.NotNil(t, invite.MaxUses)
		require.Equal(t, keybase1.TeamMaxUsesInfinite, *invite.MaxUses)
		require.NotNil(t, invite.Etime)
		require.Equal(t, now.Year()+10, invite.Etime.Time().Year())
		require.Equal(t, keybase1.TeamMaxUsesInfinite, *invite.MaxUses)
		tic, err := invite.Type.C()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamInviteCategory_INVITELINK, tic)
	}
}
