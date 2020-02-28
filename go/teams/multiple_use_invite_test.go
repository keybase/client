package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// TODO: This test might be obsolete by the time we are done with this project.
// But it's the first test that adds and "uses" multiple use invite "for real",
// that is, also sending it to the server, not just testing sigchain player.

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

	teamObj, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	makeAndPostSeitanInviteLink := func(ctx context.Context, team *Team, role keybase1.TeamRole) SCTeamInvite {
		ikey, err := GenerateIKey()
		require.NoError(t, err)
		sikey, err := ikey.GenerateSIKey()
		require.NoError(t, err)
		inviteID, err := sikey.GenerateTeamInviteID()
		require.NoError(t, err)
		label := keybase1.NewSeitanKeyLabelDefault(keybase1.SeitanKeyLabelType(0))
		_, encoded, err := ikey.GeneratePackedEncryptedKey(ctx, team, label)
		require.NoError(t, err)

		maxUses := keybase1.TeamInviteMaxUses(10)
		invite := SCTeamInvite{
			Type:    "seitan_invite_token",
			Name:    keybase1.TeamInviteName(encoded),
			ID:      inviteID,
			MaxUses: &maxUses,
		}
		err = team.postInvite(ctx, invite, role)
		require.NoError(t, err)
		return invite
	}

	scInvite := makeAndPostSeitanInviteLink(context.TODO(), teamObj, keybase1.TeamRole_READER)

	teamObj, err = Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	changeReq := keybase1.TeamChangeReq{}
	err = changeReq.AddUVWithRole(user2.GetUserVersion(), keybase1.TeamRole_READER, nil /* botSettings */)
	require.NoError(t, err)
	changeReq.UseInviteID(keybase1.TeamInviteID(scInvite.ID), user2.GetUserVersion().PercentForm())
	err = teamObj.ChangeMembershipWithOptions(context.TODO(), changeReq, ChangeMembershipOptions{})
	require.NoError(t, err)

	// User 2 loads team

	teamObj, err = Load(context.TODO(), tc2.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: false,
	})
	require.NoError(t, err)

	inner := teamObj.chain().inner
	require.Len(t, inner.ActiveInvites, 0)
	require.Len(t, inner.UsedInvites, 1)
	require.Len(t, inner.UsedInvites[keybase1.TeamInviteID(scInvite.ID)], 1)

	// User 1 makes User 2 admin

	err = SetRoleAdmin(context.TODO(), tc.G, teamname, user2.Username)
	require.NoError(t, err)

	// User 2 loads team again

	teamObj, err = Load(context.TODO(), tc2.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	inner = teamObj.chain().inner
	require.Len(t, inner.ActiveInvites, 1)
	_, ok := inner.ActiveInvites[keybase1.TeamInviteID(scInvite.ID)]
	require.True(t, ok, "invite found loaded by user 2")
	require.Len(t, inner.UsedInvites[keybase1.TeamInviteID(scInvite.ID)], 1)
}
