package systests

import (
	"testing"

	"fmt"
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestSubteamAdminships(t *testing.T) {
	// This is not a real test - we used it to debug and profile
	// multiple level subteam loading where implicit adminships were
	// involved.
	t.Skip()

	tt := newTeamTester(t)
	defer tt.cleanup()

	al := tt.addUser("al")
	bob := tt.addUser("bob")
	eve := tt.addUser("eve")

	_, teamName := al.createTeam2()

	const subteamBasename = "bb1"
	subteamID1, err := teams.CreateSubteam(context.TODO(), al.tc.G, subteamBasename,
		teamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	subTeamName1, _ := teamName.Append(subteamBasename)

	t.Logf("Subteam created %s / %s", subteamID1.String(), subTeamName1.String())

	const subSubTeamBasename = "cc2"
	subteamID2, err := teams.CreateSubteam(context.TODO(), al.tc.G, subSubTeamBasename,
		subTeamName1, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	subTeamName2, _ := subTeamName1.Append(subSubTeamBasename)

	teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID1)
	teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID1)
	teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID1)

	t.Logf("Sub-Subteam created %s / %s", subteamID2.String(), subTeamName2.String())

	teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID1)
	teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID1)
	teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID1)

	teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID2)
	teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID2)
	teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID2)

	al.addTeamMember(subTeamName2.String(), bob.username, keybase1.TeamRole_WRITER)
	al.addTeamMember(subTeamName2.String(), eve.username, keybase1.TeamRole_READER)

	bob.leave(subTeamName2.String())

	teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID2)
	teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID2)

	t.Logf("Eve loads team ...")
	fmt.Printf(":: Eve loads team %s ...\n", subteamID2.String())

	eve.loadTeam(subTeamName2.String(), false)
}
