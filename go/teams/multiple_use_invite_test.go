package teams

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/clockwork"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTeamInviteStubbing(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()
	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	tc2 := SetupTest(t, "team", 1)
	defer tc2.Cleanup()
	user2, err := kbtest.CreateAndSignupFakeUser("team", tc2.G)
	require.NoError(t, err)

	teamname := createTeam(tc)

	t.Logf("Created team %s", teamname)

	_, err = Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	maxUses := keybase1.TeamInviteMaxUses(10)
	inviteLink, err := CreateInvitelink(tc.MetaContext(), teamname, keybase1.TeamRole_READER, maxUses, nil /* etime */)
	require.NoError(t, err)

	wasSeitan, err := ParseAndAcceptSeitanToken(tc2.MetaContext(), &teamsUI{}, inviteLink.Ikey.String())
	require.NoError(t, err)
	require.True(t, wasSeitan)

	teamObj, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	var inviteID keybase1.TeamInviteID
	for _, inviteMD := range teamObj.chain().ActiveInvites() {
		inviteID = inviteMD.Invite.Id
		break // get first invite id
	}

	changeReq := keybase1.TeamChangeReq{}
	err = changeReq.AddUVWithRole(user2.GetUserVersion(), keybase1.TeamRole_READER, nil /* botSettings */)
	require.NoError(t, err)
	changeReq.UseInviteID(inviteID, user2.GetUserVersion().PercentForm())
	err = teamObj.ChangeMembershipWithOptions(context.TODO(), changeReq, ChangeMembershipOptions{})
	require.NoError(t, err)

	// User 2 loads team

	teamObj2, err := Load(context.TODO(), tc2.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: false,
	})
	require.NoError(t, err)

	inner2 := teamObj2.chain().inner
	fmt.Printf("@@@ %#v\n", teamObj2.chain().inner.InviteMetadatas)
	require.Len(t, teamObj2.chain().ActiveInvites(), 0)
	require.Len(t, inner2.InviteMetadatas[inviteID].UsedInvites, 1)

	// // User 1 makes User 2 admin

	// err = SetRoleAdmin(context.TODO(), tc.G, teamname, user2.Username)
	// require.NoError(t, err)

	// // User 2 loads team again

	// teamObj, err = Load(context.TODO(), tc2.G, keybase1.LoadTeamArg{
	// 	Name:      teamname,
	// 	NeedAdmin: true,
	// })
	// require.NoError(t, err)

	// inner = teamObj.chain().inner
	// require.Len(t, inner.ActiveInvites(), 1)
	// inviteMD, ok := inner.InviteMetadatas[inviteID]
	// invite := inviteMD.Invite
	// require.True(t, ok, "invite found loaded by user 2")
	// require.Len(t, inviteMD.UsedInvites, 1)

	// // See if User 2 can decrypt
	// pkey, err := SeitanDecodePKey(string(invite.Name))
	// require.NoError(t, err)

	// keyAndLabel, err := pkey.DecryptKeyAndLabel(context.TODO(), teamObj)
	// require.NoError(t, err)

	// ilink := keyAndLabel.Invitelink()
	// require.Equal(t, inviteLink.Ikey, ilink.I)
}

func TestSeitanHandleExceededInvite(t *testing.T) {
	// Test what happens if server sends us acceptance for an invite that's
	// exceeded. Handler should notice that and not add the member. Even it it
	// attempted to, there are additional belts and suspenders:

	// 1) sigchain pre-check should fail,
	// 2) server should not accept the link,
	// 3) if none of the above checks worked: the team would have ended up
	//    broken (not loadable) for other admins.

	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	clock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(clock)

	user2, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	kbtest.Logout(tc)

	admin, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	teamName, teamID := createTeam2(tc)
	t.Logf("Created team %s", teamName)

	// Add team invite link with max_uses=1
	maxUses := keybase1.TeamInviteMaxUses(1)
	invLink, err := CreateInvitelink(tc.MetaContext(), teamName.String(), keybase1.TeamRole_READER, maxUses, nil /* etime */)
	require.NoError(t, err)

	// Accept the link as user2.
	kbtest.LogoutAndLoginAs(tc, user2)

	uv := user2.GetUserVersion()
	unixNow := clock.Now().Unix()
	accepted, err := generateAcceptanceSeitanInviteLink(invLink.Ikey, uv, unixNow)
	require.NoError(t, err)

	err = postSeitanInviteLink(tc.MetaContext(), accepted)
	require.NoError(t, err)

	// Login as admin, call HandleTeamSeitan with a message as it would have
	// came from team_rekeyd.
	kbtest.LogoutAndLoginAs(tc, admin)
	msg := keybase1.TeamSeitanMsg{
		TeamID: teamID,
		Seitans: []keybase1.TeamSeitanRequest{
			{
				InviteID:    keybase1.TeamInviteID(accepted.inviteID),
				Uid:         uv.Uid,
				EldestSeqno: uv.EldestSeqno,
				Akey:        keybase1.SeitanAKey(accepted.encoded),
				Role:        keybase1.TeamRole_READER,
				UnixCTime:   unixNow,
			},
		},
	}
	err = HandleTeamSeitan(context.TODO(), tc.G, msg)
	require.NoError(t, err)

	// User2 leaves team.
	kbtest.LogoutAndLoginAs(tc, user2)
	err = LeaveByID(context.TODO(), tc.G, teamID, false /* permanent */)
	require.NoError(t, err)

	// Login back to admin, use same seitan gregor message
	// to try to add the user back in.
	kbtest.LogoutAndLoginAs(tc, admin)

	// `HandleTeamSeitan` should not return an error but skip over bad
	// `TeamSeitanRequest`.
	err = HandleTeamSeitan(context.TODO(), tc.G, msg)
	require.NoError(t, err)

	teamObj, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:      teamName.String(),
		NeedAdmin: true,
	})
	require.NoError(t, err)

	// The person shouldn't have been added
	members, err := teamObj.Members()
	require.NoError(t, err)

	uvs := members.AllUserVersions()
	require.Equal(t, []keybase1.UserVersion{admin.GetUserVersion()}, uvs)
}
