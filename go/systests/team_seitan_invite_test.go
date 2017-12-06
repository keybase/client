package systests

import (
	"fmt"
	"strconv"
	"testing"
	"time"

	"golang.org/x/net/context"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestTeamInviteSeitanHappy(t *testing.T) {
	testTeamInviteSeitanHappy(t, false)
}

func TestTeamInviteSeitanHappyImplicitAdmin(t *testing.T) {
	testTeamInviteSeitanHappy(t, true)
}

func testTeamInviteSeitanHappy(t *testing.T, implicitAdmin bool) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	roo := tt.addUser("roo")

	teamIDParent, teamNameParent := own.createTeam2()
	teamID := teamIDParent
	teamName := teamNameParent
	t.Logf("Created team %v %v", teamIDParent, teamNameParent)
	if implicitAdmin {
		subteamID, err := teams.CreateSubteam(context.TODO(), tt.users[0].tc.G, "sub1", teamNameParent)
		require.NoError(t, err)
		teamID = *subteamID
		subteamName, err := teamNameParent.Append("sub1")
		require.NoError(t, err)
		teamName = subteamName
		t.Logf("Created subteam %v %v", teamID, teamName)
	}

	label := keybase1.NewSeitanIKeyLabelWithSms(keybase1.SeitanIKeyLabelSms{
		F: "bugs",
		N: "0000",
	})
	token, err := own.teamsClient.TeamCreateSeitanToken(context.TODO(), keybase1.TeamCreateSeitanTokenArg{
		Name:  teamName.String(),
		Role:  keybase1.TeamRole_WRITER,
		Label: label,
	})
	require.NoError(t, err)

	t.Logf("Created token %q", token)

	details := own.teamGetDetails(teamName.String())
	require.Len(t, details.AnnotatedActiveInvites, 1)
	for _, invite := range details.AnnotatedActiveInvites {
		require.Equal(t, keybase1.TeamRole_WRITER, invite.Role)
		tic, err := invite.Type.C()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamInviteCategory_SEITAN, tic)
		require.Equal(t, keybase1.TeamInviteName("bugs (0000)"), invite.Name)
	}

	err = roo.teamsClient.TeamAcceptInvite(context.TODO(), keybase1.TeamAcceptInviteArg{
		Token: string(token),
	})
	require.NoError(t, err)

	t.Logf("User used token, waiting for rekeyd")

	own.kickTeamRekeyd()
	own.waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	t0, err := teams.GetTeamByNameForTest(context.TODO(), own.tc.G, teamName.String(), false /* public */, true /* needAdmin */)
	require.NoError(t, err)

	role, err := t0.MemberRole(context.TODO(), teams.NewUserVersion(roo.uid, 1))
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_WRITER)

	details = own.teamGetDetails(teamName.String())
	require.Len(t, details.AnnotatedActiveInvites, 0)
}

func TestTeamInviteSeitanFailures(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	roo := tt.addUser("roo")

	teamID, teamName := own.createTeam2()

	t.Logf("Created team %q", teamName.String())

	token, err := own.teamsClient.TeamCreateSeitanToken(context.Background(), keybase1.TeamCreateSeitanTokenArg{
		Name: teamName.String(),
		Role: keybase1.TeamRole_WRITER,
	})
	require.NoError(t, err)

	t.Logf("Created token %q", token)

	// Generate invitation id, but make AKey with different IKey.
	// Simulate "replay attack" or similar.
	ikey, err := teams.GenerateIKeyFromString(string(token))
	require.NoError(t, err)
	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	inviteIDx, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)
	inviteID, err := keybase1.TeamInviteIDFromString(string(inviteIDx))
	require.NoError(t, err)

	ikey2, err := teams.GenerateIKey()
	require.NoError(t, err)
	sikey2, err := ikey2.GenerateSIKey()
	require.NoError(t, err)
	unixNow := time.Now().Unix()
	_, maliciousPayload, err := sikey2.GenerateAcceptanceKey(roo.uid, roo.userVersion().EldestSeqno, unixNow)
	require.NoError(t, err)

	arg := libkb.NewAPIArgWithNetContext(context.Background(), "team/seitan")
	arg.Args = libkb.NewHTTPArgs()
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args.Add("akey", libkb.S{Val: maliciousPayload})
	arg.Args.Add("now", libkb.S{Val: strconv.FormatInt(unixNow, 10)})
	arg.Args.Add("invite_id", libkb.S{Val: string(inviteID)})
	_, err = roo.tc.G.API.Post(arg)
	require.NoError(t, err)

	t.Logf("handle synthesized rekeyd command")
	msg := keybase1.TeamSeitanMsg{
		TeamID: teamID,
		Seitans: []keybase1.TeamSeitanRequest{{
			InviteID:    inviteID,
			Uid:         roo.uid,
			EldestSeqno: roo.userVersion().EldestSeqno,
			Akey:        keybase1.SeitanAKey(maliciousPayload),
			Role:        keybase1.TeamRole_WRITER,
			UnixCTime:   unixNow,
		}},
	}
	err = teams.HandleTeamSeitan(context.Background(), own.tc.G, msg)
	require.NoError(t, err)

	t.Logf("invite should still be there")
	t0, err := teams.GetTeamByNameForTest(context.Background(), own.tc.G, teamName.String(), false /* public */, true /* needAdmin */)
	require.NoError(t, err)
	require.Equal(t, 1, t0.NumActiveInvites(), "invite should still be active")
	require.EqualValues(t, t0.CurrentSeqno(), 2)

	t.Logf("user should not be in team")
	role, err := t0.MemberRole(context.Background(), roo.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_NONE, role, "user role")
}

func TestTeamCreateSeitanAndCancel(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")

	_, teamName := own.createTeam2()

	t.Logf("Created team %q", teamName.String())

	var labelSms keybase1.SeitanIKeyLabelSms
	labelSms.F = "Patricia S. Goldman-Rakic"
	labelSms.N = "+481II222333"

	_, err := own.teamsClient.TeamCreateSeitanToken(context.TODO(), keybase1.TeamCreateSeitanTokenArg{
		Name:  teamName.String(),
		Role:  keybase1.TeamRole_WRITER,
		Label: keybase1.NewSeitanIKeyLabelWithSms(labelSms),
	})
	require.NoError(t, err)

	t.Logf("Created Seitan token")

	details, err := own.teamsClient.TeamGet(context.TODO(), keybase1.TeamGetArg{
		Name:        teamName.String(),
		ForceRepoll: true,
	})
	require.NoError(t, err)

	var inviteID keybase1.TeamInviteID

	require.Equal(t, 1, len(details.AnnotatedActiveInvites))
	for key, invite := range details.AnnotatedActiveInvites {
		require.Equal(t, keybase1.TeamRole_WRITER, invite.Role)
		require.EqualValues(t, fmt.Sprintf("%s (%s)", labelSms.F, labelSms.N), invite.Name)

		category, err := invite.Type.C()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamInviteCategory_SEITAN, category)

		// Test rest of the params, unrelated to Seitan.
		require.Equal(t, key, invite.Id)
		require.Equal(t, keybase1.UserVersion{}, invite.Uv)
		require.Equal(t, keybase1.UserVersion{Uid: own.uid, EldestSeqno: 1}, invite.Inviter)
		require.Equal(t, own.username, invite.InviterUsername)
		require.Equal(t, teamName.String(), invite.TeamName)

		inviteID = invite.Id
	}

	t.Logf("Checked that invite was added correctly, removing invite by id")

	err = own.teamsClient.TeamRemoveMember(context.TODO(), keybase1.TeamRemoveMemberArg{
		Name:     teamName.String(),
		InviteID: inviteID,
	})
	require.NoError(t, err)

	t.Logf("Removed, checking if there are no active invites")

	t0, err := teams.GetTeamByNameForTest(context.TODO(), own.tc.G, teamName.String(), false /* public */, true /* needAdmin */)
	require.NoError(t, err)
	require.Equal(t, 0, t0.NumActiveInvites())
}
