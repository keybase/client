package teams

import (
	"context"
	"fmt"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func testTeamCreateSeitanAndCancel(t *testing.T, seitanVersion SeitanVersion) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	teamName, teamID := createTeam2(tc)

	t.Logf("Created team %q", teamName.String())

	var labelSms keybase1.SeitanKeyLabelSms
	labelSms.F = "Patricia S. Goldman-Rakic"
	labelSms.N = "+481II222333"
	label := keybase1.NewSeitanKeyLabelWithSms(labelSms)

	switch seitanVersion {
	case SeitanVersion1:
		_, err = CreateSeitanToken(context.TODO(), tc.G, teamName.String(), keybase1.TeamRole_WRITER, label)
	case SeitanVersion2:
		_, err = CreateSeitanTokenV2(context.TODO(), tc.G, teamName.String(), keybase1.TeamRole_WRITER, label)
	default:
		t.Logf("Invalid seitan version %v", seitanVersion)
		t.FailNow()
	}
	require.NoError(t, err)

	t.Logf("Created Seitan token")

	details, err := Details(context.TODO(), tc.G, teamName.String())
	require.NoError(t, err)

	var inviteID keybase1.TeamInviteID

	require.Equal(t, 1, len(details.AnnotatedActiveInvites))
	for key, aInvite := range details.AnnotatedActiveInvites {
		invite := aInvite.InviteMetadata.Invite
		require.Equal(t, keybase1.TeamRole_WRITER, invite.Role)
		require.EqualValues(t, fmt.Sprintf("%s (%s)", labelSms.F, labelSms.N), aInvite.DisplayName)

		category, err := invite.Type.C()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamInviteCategory_SEITAN, category)

		// Test rest of the params, unrelated to Seitan.
		require.Equal(t, key, invite.Id)
		require.Equal(t, user.GetUserVersion(), invite.Inviter)
		require.Equal(t, user.Username, aInvite.InviterUsername)
		require.Equal(t, teamName.String(), aInvite.TeamName)

		inviteID = invite.Id
	}

	t.Logf("Checked that invite was added correctly, removing invite by id")

	err = CancelInviteByID(context.TODO(), tc.G, teamID, inviteID)
	require.NoError(t, err)

	t.Logf("Removed, checking if there are no active invites")

	t0, err := GetTeamByNameForTest(context.TODO(), tc.G, teamName.String(), false /* public */, true /* needAdmin */)
	require.NoError(t, err)
	require.Equal(t, 0, t0.NumActiveInvites())
}

func TestTeamCreateSeitanAndCancel(t *testing.T) {
	testTeamCreateSeitanAndCancel(t, SeitanVersion1)
	testTeamCreateSeitanAndCancel(t, SeitanVersion2)
}
