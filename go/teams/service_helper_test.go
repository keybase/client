package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func countMember(t *testing.T, members []keybase1.TeamMemberDetails, username string, needsPuk bool, status keybase1.TeamMemberStatus) int {
	c := 0
	for _, member := range members {
		if member.Username == username {
			require.Equal(t, needsPuk, member.NeedsPUK)
			require.Equal(t, status, member.Status)
			c++
		}
	}
	return c
}

// TestGetAnnotatedTeamIdiosyncrasies tests behavior of GetAnnotatedTeam that in some way alters the
// view of the teamchain, for the sake of presentation in the UI. These cases mainly involve
// members, invites, keybase-type member invites, resets, and deletions.
func TestGetAnnotatedTeamIdiosyncrasies(t *testing.T) {
	tc := SetupTest(t, "team", 1)

	tc.G.UIDMapper.SetTestingNoCachingMode(true)

	ali, err := kbtest.CreateAndSignupFakeUser("alih", tc.G)
	require.NoError(t, err)
	del, err := kbtest.CreateAndSignupFakeUser("delh", tc.G)
	require.NoError(t, err)

	adm, err := kbtest.CreateAndSignupFakeUser("admh", tc.G)
	require.NoError(t, err)
	name, ID := createTeam2(tc)

	ctx := context.TODO()

	_, err = AddMember(ctx, tc.G, name.String(), ali.Username, keybase1.TeamRole_OWNER, nil)
	require.NoError(t, err)
	_, err = AddMember(ctx, tc.G, name.String(), del.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	tm, err := GetAnnotatedTeam(ctx, tc.G, ID)
	require.NoError(t, err)
	require.Len(t, tm.Members, 3)
	require.Equal(t, 1, countMember(t, tm.Members, adm.Username, false, keybase1.TeamMemberStatus_ACTIVE))
	require.Equal(t, 1, countMember(t, tm.Members, ali.Username, false, keybase1.TeamMemberStatus_ACTIVE))
	require.Equal(t, 1, countMember(t, tm.Members, del.Username, false, keybase1.TeamMemberStatus_ACTIVE))

	t.Logf("ali resets but doesnt log back in")
	kbtest.Logout(tc)
	err = ali.Login(tc.G)
	require.NoError(t, err)
	kbtest.ResetAccount(tc, ali)

	kbtest.Logout(tc)
	err = del.Login(tc.G)
	require.NoError(t, err)

	err = reAddMemberAfterResetInner(ctx, tc.G, ID, ali.Username)
	require.NoError(t, err)
	team, err := GetForTestByStringName(context.TODO(), tc.G, name.String())
	require.NoError(t, err)
	require.True(t, team.IsMember(ctx, ali.GetUserVersion()), "ali is a cryptomember, though reset")
	resetUV := keybase1.UserVersion{
		Uid:         ali.GetUID(),
		EldestSeqno: 0,
	}
	t.Logf("assert that ali is also invited as an admin")
	assertInvite(tc, name.String(), resetUV.String(), "keybase", keybase1.TeamRole_ADMIN)
	tm, err = GetAnnotatedTeam(ctx, tc.G, ID)
	require.NoError(t, err)
	require.Len(t, tm.Members, 3, "GetAnnotatedTeam returns only one result for Ali anyway, filtering out inactive owners")
	require.Equal(t, 1, countMember(t, tm.Members, ali.Username, true, keybase1.TeamMemberStatus_ACTIVE), "ali added as a kb invite")
}

func TestGetAnnotatedTeamKeybaseInvites(t *testing.T) {
	tc := SetupTest(t, "team", 1)

	tc.G.UIDMapper.SetTestingNoCachingMode(true)

	ali, err := kbtest.CreateAndSignupFakeUser("alih", tc.G)
	require.NoError(t, err)
	tc.Tp.DisableUpgradePerUserKey = true

	cha, err := kbtest.CreateAndSignupFakeUser("chah", tc.G)
	require.NoError(t, err)

	kbtest.Logout(tc)
	err = ali.Login(tc.G)
	require.NoError(t, err)

	ctx := context.TODO()
	name, ID := createTeam2(tc)

	_, err = AddMember(ctx, tc.G, name.String(), cha.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	tc.Tp.DisableUpgradePerUserKey = false
	kbtest.Logout(tc)
	err = cha.Login(tc.G)
	require.NoError(t, err)
	perUserKeyUpgradeSoft(ctx, tc.G, "test")

	kbtest.Logout(tc)
	err = ali.Login(tc.G)
	require.NoError(t, err)

	tm, err := GetAnnotatedTeam(ctx, tc.G, ID)
	require.NoError(t, err)
	require.Len(t, tm.Members, 2)
	require.Equal(t, 1, countMember(t, tm.Members, cha.Username, true, keybase1.TeamMemberStatus_ACTIVE))

	_, err = AddMember(ctx, tc.G, name.String(), cha.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	tm, err = GetAnnotatedTeam(ctx, tc.G, ID)
	require.NoError(t, err)
	require.Len(t, tm.Members, 2)
	require.Equal(t, 1, countMember(t, tm.Members, cha.Username, false, keybase1.TeamMemberStatus_ACTIVE))
}
