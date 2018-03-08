package systests

import (
	"testing"

	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"

	"github.com/stretchr/testify/require"
)

func testSubteamCreate(t *testing.T, joinSubteam bool) {
	t.Logf("testSubteamCreate(joinSubteam: %t)", joinSubteam)

	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up ann %s", ann.username)

	parentName := ann.createTeam()
	subteamName := parentName + ".test"

	cli := ann.teamsClient
	res, err := cli.TeamCreate(context.Background(), keybase1.TeamCreateArg{
		Name:        subteamName,
		JoinSubteam: joinSubteam,
	})
	require.NoError(t, err)
	require.Equal(t, joinSubteam, res.CreatorAdded)
	require.True(t, res.ChatSent)

	t.Logf("Created subteam %s", subteamName)

	teamObj := ann.loadTeam(subteamName, false /* admin */)
	role, err := teamObj.MemberRole(context.Background(), ann.userVersion())
	require.NoError(t, err)

	if joinSubteam {
		require.Equal(t, keybase1.TeamRole_ADMIN, role, "role should be ADMIN")
		require.EqualValues(t, 1, teamObj.CurrentSeqno(), "expecting just one link in team")
	} else {
		require.Equal(t, keybase1.TeamRole_NONE, role, "role should be NONE")
		// Expecting 3 links: subteam_head, leave, rotate_key
		ann.waitForRotateByID(teamObj.ID, keybase1.Seqno(3))
	}
}

func TestSubteamCreate(t *testing.T) {
	testSubteamCreate(t, false)
	testSubteamCreate(t, true)
}
