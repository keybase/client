package systests

import (
	"testing"

	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

// Parameterized high-level tests (using team service API and gregor handler)
// for Seitan V1 and Seitan V2.

func TestTeamInviteSeitanHappy(t *testing.T) {
	testTeamInviteSeitanHappy(t, false /* implicitAdmin */, teams.SeitanVersion1)
	testTeamInviteSeitanHappy(t, false /* implicitAdmin */, teams.SeitanVersion2)
}

func TestTeamInviteSeitanHappyImplicitAdmin(t *testing.T) {
	testTeamInviteSeitanHappy(t, true /* implicitAdmin */, teams.SeitanVersion1)
	testTeamInviteSeitanHappy(t, true /* implicitAdmin */, teams.SeitanVersion2)
}

func testTeamInviteSeitanHappy(t *testing.T, implicitAdmin bool, seitanVersion teams.SeitanVersion) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	roo := tt.addUser("roo")

	teamIDParent, teamNameParent := own.createTeam2()
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

	label := keybase1.NewSeitanKeyLabelWithSms(keybase1.SeitanKeyLabelSms{
		F: "bugs",
		N: "0000",
	})
	var token string
	switch seitanVersion {
	case teams.SeitanVersion1:
		ikey, err := own.teamsClient.TeamCreateSeitanToken(context.TODO(), keybase1.TeamCreateSeitanTokenArg{
			Teamname: teamName.String(),
			Role:     keybase1.TeamRole_WRITER,
			Label:    label,
		})
		token = string(ikey)
		require.NoError(t, err)
	case teams.SeitanVersion2:
		ikey, err := own.teamsClient.TeamCreateSeitanTokenV2(context.TODO(), keybase1.TeamCreateSeitanTokenV2Arg{
			Teamname: teamName.String(),
			Role:     keybase1.TeamRole_WRITER,
			Label:    label,
		})
		token = string(ikey)
		require.NoError(t, err)
	default:
		t.Fatalf("Invalid seitan version %v", seitanVersion)
	}

	t.Logf("Created token %q", token)

	details := own.teamGetDetails(teamName.String())
	require.Len(t, details.AnnotatedActiveInvites, 1)
	for _, invite := range details.AnnotatedActiveInvites {
		require.Equal(t, keybase1.TeamRole_WRITER, invite.InviteMetadata.Invite.Role)
		tic, err := invite.InviteMetadata.Invite.Type.C()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamInviteCategory_SEITAN, tic)
		require.Equal(t, keybase1.TeamInviteDisplayName("bugs (0000)"), invite.DisplayName)
	}

	roo.kickTeamRekeyd()
	err := roo.teamsClient.TeamAcceptInvite(context.TODO(), keybase1.TeamAcceptInviteArg{
		Token: token,
	})
	require.NoError(t, err)

	t.Logf("User used token, waiting for rekeyd")

	own.waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	t0, err := teams.GetTeamByNameForTest(context.TODO(), own.tc.G, teamName.String(), false /* public */, true /* needAdmin */)
	require.NoError(t, err)

	role, err := t0.MemberRole(context.TODO(), teams.NewUserVersion(roo.uid, 1))
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_WRITER)

	details = own.teamGetDetails(teamName.String())
	require.Len(t, details.AnnotatedActiveInvites, 0)
}
