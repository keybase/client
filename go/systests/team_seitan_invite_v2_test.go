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
		require.Equal(t, keybase1.TeamRole_WRITER, invite.Invite.Role)
		tic, err := invite.Invite.Type.C()
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

func TestTeamInviteSeitanV2Failures(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	roo := tt.addUser("roo")

	teamID, teamName := own.createTeam2()

	t.Logf("Created team %q", teamName.String())

	token, err := own.teamsClient.TeamCreateSeitanTokenV2(context.Background(), keybase1.TeamCreateSeitanTokenV2Arg{
		Teamname: teamName.String(),
		Role:     keybase1.TeamRole_WRITER,
	})
	require.NoError(t, err)

	t.Logf("Created token %q", token)

	// Generate invitation id, but make Signature with different IKey.
	// Simulate "replay attack" or similar.
	ikey, err := teams.ParseIKeyV2FromString(string(token))
	require.NoError(t, err)
	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	inviteIDx, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)
	inviteID, err := keybase1.TeamInviteIDFromString(string(inviteIDx))
	require.NoError(t, err)

	ikey2, err := teams.GenerateIKeyV2()
	require.NoError(t, err)
	sikey2, err := ikey2.GenerateSIKey()
	require.NoError(t, err)
	now := keybase1.ToTime(time.Now())
	_, maliciousPayload, err := sikey2.GenerateSignature(roo.uid, roo.userVersion().EldestSeqno, teams.SCTeamInviteID(inviteID), now)
	require.NoError(t, err)

	ctx := context.Background()

	arg := libkb.NewAPIArg("team/seitan_v2")
	arg.Args = libkb.NewHTTPArgs()
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args.Add("sig", libkb.S{Val: maliciousPayload})
	arg.Args.Add("now", libkb.S{Val: strconv.FormatInt(int64(now), 10)})
	arg.Args.Add("invite_id", libkb.S{Val: string(inviteID)})
	mctx := libkb.NewMetaContext(ctx, roo.tc.G)
	_, err = roo.tc.G.API.Post(mctx, arg)
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
			UnixCTime:   int64(now),
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

func testTeamCreateSeitanAndCancel(t *testing.T, seitanVersion teams.SeitanVersion) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")

	teamID, teamName := own.createTeam2()

	t.Logf("Created team %q", teamName.String())

	var labelSms keybase1.SeitanKeyLabelSms
	labelSms.F = "Patricia S. Goldman-Rakic"
	labelSms.N = "+481II222333"
	label := keybase1.NewSeitanKeyLabelWithSms(labelSms)

	var err error
	switch seitanVersion {
	case teams.SeitanVersion1:
		_, err = own.teamsClient.TeamCreateSeitanToken(context.TODO(), keybase1.TeamCreateSeitanTokenArg{
			Teamname: teamName.String(),
			Role:     keybase1.TeamRole_WRITER,
			Label:    label,
		})
	case teams.SeitanVersion2:
		_, err = own.teamsClient.TeamCreateSeitanTokenV2(context.TODO(), keybase1.TeamCreateSeitanTokenV2Arg{
			Teamname: teamName.String(),
			Role:     keybase1.TeamRole_WRITER,
			Label:    label,
		})
	default:
		t.Logf("Invalid seitan version %v", seitanVersion)
		t.FailNow()
	}
	require.NoError(t, err)

	t.Logf("Created Seitan token")

	details, err := own.teamsClient.TeamGet(context.TODO(), keybase1.TeamGetArg{
		Name: teamName.String(),
	})
	require.NoError(t, err)

	var inviteID keybase1.TeamInviteID

	require.Equal(t, 1, len(details.AnnotatedActiveInvites))
	for key, aInvite := range details.AnnotatedActiveInvites {
		invite := aInvite.Invite
		require.Equal(t, keybase1.TeamRole_WRITER, invite.Role)
		require.EqualValues(t, fmt.Sprintf("%s (%s)", labelSms.F, labelSms.N), aInvite.DisplayName)

		category, err := invite.Type.C()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamInviteCategory_SEITAN, category)

		// Test rest of the params, unrelated to Seitan.
		require.Equal(t, key, invite.Id)
		require.Equal(t, keybase1.UserVersion{}, aInvite.InviteeUv)
		require.Equal(t, keybase1.UserVersion{Uid: own.uid, EldestSeqno: 1}, invite.Inviter)
		require.Equal(t, own.username, aInvite.InviterUsername)
		require.Equal(t, teamName.String(), aInvite.TeamName)

		inviteID = invite.Id
	}

	t.Logf("Checked that invite was added correctly, removing invite by id")

	err = own.teamsClient.TeamRemoveMember(context.TODO(), keybase1.TeamRemoveMemberArg{
		TeamID:   teamID,
		InviteID: inviteID,
	})
	require.NoError(t, err)

	t.Logf("Removed, checking if there are no active invites")

	t0, err := teams.GetTeamByNameForTest(context.TODO(), own.tc.G, teamName.String(), false /* public */, true /* needAdmin */)
	require.NoError(t, err)
	require.Equal(t, 0, t0.NumActiveInvites())
}

func TestTeamCreateSeitanAndCancel(t *testing.T) {
	testTeamCreateSeitanAndCancel(t, teams.SeitanVersion1)
	testTeamCreateSeitanAndCancel(t, teams.SeitanVersion2)
}

func testTeamInviteSeitanPukless(t *testing.T, seitanVersion teams.SeitanVersion) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	bee := tt.addUser("bee")
	cass := tt.addPuklessUser("cass")
	tt.logUserNames()

	teamID, teamName := bee.createTeam2()
	t.Logf("Created team %s", teamName.String())

	label := keybase1.NewSeitanKeyLabelWithSms(keybase1.SeitanKeyLabelSms{
		F: "cass",
		N: "+1-800-CRYPTO",
	})
	var token string
	switch seitanVersion {
	case teams.SeitanVersion1:
		ikey, err := bee.teamsClient.TeamCreateSeitanToken(context.Background(), keybase1.TeamCreateSeitanTokenArg{
			Teamname: teamName.String(),
			Role:     keybase1.TeamRole_WRITER,
			Label:    label,
		})
		token = string(ikey)
		require.NoError(t, err)
	case teams.SeitanVersion2:
		ikey, err := bee.teamsClient.TeamCreateSeitanTokenV2(context.Background(), keybase1.TeamCreateSeitanTokenV2Arg{
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

	bee.kickTeamRekeyd()
	err := cass.teamsClient.TeamAcceptInvite(context.Background(), keybase1.TeamAcceptInviteArg{
		Token: token,
	})
	require.NoError(t, err)

	teamObj := bee.loadTeam(teamName.String(), true /* admin */)
	invites := teamObj.GetActiveAndObsoleteInvites()
	require.Len(t, invites, 1)
	for _, invite := range invites {
		// Invite should be WAITING_FOR_PUK now and we can't cancel it anymore.
		err := teams.CancelInviteByID(context.Background(), bee.tc.G, teamID, invite.Id, false)
		require.Error(t, err)
	}

	cass.kickTeamRekeyd()
	cass.perUserKeyUpgrade()

	bee.waitForTeamChangedGregor(teamID, keybase1.Seqno(3))
	teamObj = bee.loadTeam(teamName.String(), true /* admin */)
	// Invite should be completed now.
	require.Len(t, teamObj.GetActiveAndObsoleteInvites(), 0)
	// Cass should be brought in as WRITER.
	role, err := teamObj.MemberRole(context.Background(), cass.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_WRITER, role)
}

func TestTeamInviteSeitanPuklessV1(t *testing.T) {
	testTeamInviteSeitanPukless(t, teams.SeitanVersion1)
}

func TestTeamInviteSeitanPuklessV2(t *testing.T) {
	testTeamInviteSeitanPukless(t, teams.SeitanVersion2)
}
