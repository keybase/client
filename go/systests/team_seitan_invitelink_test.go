package systests

import (
	"testing"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
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
		Role:     keybase1.TeamRole_ADMIN,
		MaxUses:  maxUses,
		Etime:    &etime,
	})
	require.NoError(t, err)

	t.Logf("Created token %v", link)

	details := alice.teamGetDetails(teamName.String())
	require.Len(t, details.AnnotatedActiveInvites, 1)
	for _, invite := range details.AnnotatedActiveInvites {
		require.Equal(t, keybase1.TeamRole_ADMIN, invite.Role)
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
	require.Equal(t, role, keybase1.TeamRole_ADMIN)
}
